'use client';

import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

interface UploadBatch {
  id: string;
  file_name: string;
  row_count: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

interface ExcelUploadProps {
    onUploadComplete: () => void;
    userId: string;
    userEmail?: string;
  }
  
  export default function ExcelUpload({ onUploadComplete, userId, userEmail }: ExcelUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the history of uploaded Excel sheets
  async function fetchBatches() {
    const { data, error } = await supabase
      .from('upload_batches')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setBatches(data);
    }
  }

  useEffect(() => {
    fetchBatches();
  }, []);

  function cleanText(val: any): string | null {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    return str === '' ? null : str;
  }

  function cleanNumber(val: any): number | null {
    if (val === undefined || val === null || val === '') return null;
    const cleaned = String(val).replace(/,/g, '').trim();
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }

  function cleanInt(val: any): number | null {
    const num = cleanNumber(val);
    return num === null ? null : Math.round(num);
  }

  function formatDateTime(isoString: string) {
    return new Date(isoString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setErrorMessage('');
    setStatusMessage('Reading Excel file...');

    let createdBatchId: string | null = null;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
      });

      if (rawRows.length === 0) {
        throw new Error('The uploaded spreadsheet is empty.');
      }

      const parsedRows = rawRows
        .map((row) => {
          const norm: Record<string, any> = {};
          for (const key of Object.keys(row)) {
            norm[key.trim().toUpperCase()] = row[key];
          }

          return {
            lan: cleanText(norm['LAN']),
            customer_name: cleanText(norm['CUST_NAME'] ?? norm['CUSTOMER_NAME']),
            npa_stage: cleanText(norm['NPA STAGE'] ?? norm['NPA_STAGE']),
            region: cleanText(norm['REGION']),
            product: cleanText(norm['PRODUCT']),
            bkt: cleanInt(norm['BKT']),
            emi: cleanNumber(norm['EMI']),
            arrear_amount: cleanNumber(norm['ARREAR AMOUNT'] ?? norm['ARREAR_AMOUNT']),
            pos: cleanNumber(norm['POS']),
            registration_number: cleanText(norm['REG'] ?? norm['REGISTRATION_NUMBER']),
            asset_description: cleanText(norm['ASST_DSC'] ?? norm['ASSET_DESCRIPTION']),
            engine_number: cleanText(norm['ENG'] ?? norm['ENGINE_NUMBER']),
            chassis_number: cleanText(norm['CHASSIS'] ?? norm['CHASSIS_NUMBER']),
            branch: cleanText(norm['BRANCH']),
            status: cleanText(norm['STATUS']) || 'Pending',
          };
        })
        .filter((r) => r.lan || r.customer_name || r.registration_number || r.chassis_number);

      if (parsedRows.length === 0) {
        throw new Error('No valid vehicle columns found. Check your Excel headers.');
      }

      // 1. Create a tracker entry in upload_batches first
      const { data: batchData, error: batchError } = await supabase
      .from('upload_batches')
      .insert({
        file_name: file.name,
        row_count: parsedRows.length,
        uploaded_by: userEmail || 'Admin',
        admin_id: userId,
      })
      .select()
      .single();

      if (batchError || !batchData) {
        throw new Error('Could not create upload record: ' + batchError?.message);
      }

      createdBatchId = batchData.id;

      // 2. Stamp every vehicle row with this sheet's batch_id
      const formattedRows = parsedRows.map((row) => ({
        ...row,
        batch_id: createdBatchId,
        admin_id: userId,
      }));

      // 3. Upload in safe chunks of 500 rows
      const BATCH_SIZE = 500;
      const total = formattedRows.length;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = formattedRows.slice(i, i + BATCH_SIZE);

        const { error } = await supabase.from('vehicles').insert(chunk);
        if (error) {
          throw new Error(`Upload failed at row ${i + 1}: ${error.message}`);
        }

        const uploadedCount = Math.min(i + BATCH_SIZE, total);
        const percent = Math.round((uploadedCount / total) * 100);
        setProgress(percent);
        setStatusMessage(
          `Uploading ${uploadedCount.toLocaleString()} / ${total.toLocaleString()} vehicles (${percent}%)...`
        );
      }

      setStatusMessage(`Successfully uploaded "${file.name}" (${total.toLocaleString()} vehicles)!`);
      await fetchBatches();
      onUploadComplete();
    } catch (err: any) {
      // Roll back partial upload cleanly if anything fails midway
      if (createdBatchId) {
        await supabase.from('upload_batches').delete().eq('id', createdBatchId);
      }
      setErrorMessage(err.message || 'Something went wrong while uploading.');
      setStatusMessage('');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // Delete an entire Excel sheet (Postgres ON DELETE CASCADE deletes all linked vehicles)
  async function handleDeleteBatch(batch: UploadBatch) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${batch.file_name}"?\n\nThis will remove all ${batch.row_count.toLocaleString()} vehicles from this sheet.`
    );
    if (!confirmed) return;

    setDeletingId(batch.id);
    setErrorMessage('');
    setStatusMessage('');

    const { error } = await supabase.from('upload_batches').delete().eq('id', batch.id);

    if (error) {
      setErrorMessage('Failed to delete sheet: ' + error.message);
    } else {
      setStatusMessage(
        `Deleted "${batch.file_name}" and all ${batch.row_count.toLocaleString()} linked vehicles.`
      );
      await fetchBatches();
      onUploadComplete();
    }

    setDeletingId(null);
  }

  return (
    <div className="mb-6 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
      {/* Top Row: Upload Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Excel Sheet Manager</h2>
          <p className="text-xs text-gray-500">
            Upload raw bank dumps (.xlsx, .xls, .csv) or delete old sheets in one click.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          disabled={uploading || deletingId !== null}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deletingId !== null}
          className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition cursor-pointer ${
            uploading || deletingId !== null
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {uploading ? `Uploading (${progress}%)...` : '+ Upload Excel / CSV'}
        </button>
      </div>

      {/* Live Upload Progress Bar */}
      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-green-600 h-2.5 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1.5 font-medium">{statusMessage}</p>
        </div>
      )}

      {/* Status / Error Alerts */}
      {!uploading && statusMessage && (
        <div className="mt-3 p-2.5 bg-green-50 border border-green-200 text-green-700 text-xs font-medium rounded-lg">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Upload History Table */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Uploaded Sheets ({batches.length})
        </h3>

        {batches.length === 0 ? (
          <p className="text-xs text-gray-400">No Excel sheets uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600">
                  <th className="p-2.5">File Name</th>
                  <th className="p-2.5">Uploaded On (Date & Time)</th>
                  <th className="p-2.5">Uploaded By</th>
                  <th className="p-2.5">Rows</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="p-2.5 font-semibold text-gray-800">{batch.file_name}</td>
                    <td className="p-2.5 text-gray-600">{formatDateTime(batch.uploaded_at)}</td>
                    <td className="p-2.5 text-gray-500">{batch.uploaded_by || 'Admin'}</td>
                    <td className="p-2.5 font-medium text-blue-600">
                      {batch.row_count.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => handleDeleteBatch(batch)}
                        disabled={deletingId !== null || uploading}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                          deletingId === batch.id
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white'
                        }`}
                      >
                        {deletingId === batch.id ? 'Deleting...' : 'Delete Sheet'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}