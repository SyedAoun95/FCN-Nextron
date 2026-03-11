"use client";

import React, { useState, useEffect } from "react";
import { initDB } from "../services/db";

interface Person {
  _id: string;
  name: string;
  connectionNumber?: string;
  monthlyFee: number;
  createdAt: string;
}

interface Area {
  _id: string;
  name: string;
}

interface Defaulter {
  personId: string;
  personName: string;
  connectionNumber?: string;
  unpaidMonths: number;
  accumulatedBalance: number;
  currentMonthBalance: number; // Added field for current month's balance
}

export default function DefaulterListsPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadAreas = async () => {
      const db = await initDB();
      if (!db) return;
      const areaList = await db.getAreas();
      setAreas((areaList || []) as any);
    };
    loadAreas();
  }, []);

  const loadDefaulters = async () => {
    if (!selectedArea || !selectedMonth) return;
    setLoading(true);
    const db = await initDB();
    if (!db) return;

    const persons = await db.getPersonsByArea(selectedArea);
    const defaulterList: Defaulter[] = [];

    for (const person of persons) {
      const debits = await db.localDB.find({
        selector: {
          type: "debit",
          personId: person._id,
          month: selectedMonth
        }
      });

     const currentMonthBalance = debits.docs.reduce(
  (sum: number, debit: any) => sum + (debit.amount || 0),
  0
);

      const personStart = new Date((person as any).createdAt);
      const selectedDate = new Date(selectedMonth + "-01");
      const monthsDiff = Math.max(0, (selectedDate.getFullYear() - personStart.getFullYear()) * 12 + (selectedDate.getMonth() - personStart.getMonth()) + 1);
      let unpaidCount = 0;
      for (let i = 0; i < monthsDiff; i++) {
        const checkDate = new Date(personStart.getFullYear(), personStart.getMonth() + i, 1);
        const checkMonth = checkDate.toISOString().slice(0, 7);
        const checkDebits = await db.localDB.find({
          selector: {
            type: "debit",
            personId: person._id,
            month: checkMonth
          }
        });
        if (checkDebits.docs.length === 0) {
          unpaidCount++;
        }
      }
      const accumulatedBalance = unpaidCount * ((person as any).monthlyFee || 0);
      if (accumulatedBalance > 0 || currentMonthBalance > 0) {
        defaulterList.push({
          personId: person._id,
          personName: (person as any).name,
          connectionNumber: (person as any).connectionNumber,
          unpaidMonths: unpaidCount,
          accumulatedBalance,
          currentMonthBalance
        });
      }
    }

    setDefaulters(defaulterList);
    setLoading(false);
  };

  useEffect(() => {
    loadDefaulters();
  }, [selectedArea, selectedMonth]);

  const printDefaulters = () => {
    const printWindow = window.open('', '', 'width=1200,height=600');
    if (!printWindow) return;

    const tableRows = defaulters.map((d) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${d.personName}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${d.connectionNumber || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${d.unpaidMonths}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">Rs.${d.accumulatedBalance.toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">Rs.${d.currentMonthBalance.toFixed(2)}</td> <!-- Added field for current month's balance -->
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Defaulter Lists</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align:center; }
          table { width:100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align:left; padding:10px; border-bottom:2px solid #ddd }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- Urdu Header -->
          <div class="urdu-header">
            <h2>فیملی کیبل نیٹ ورک</h2>
          </div>
          
          <!-- Urdu Names Section -->
          <div class="urdu-names">
            <h3>خالد محمود خان</h3>
            <div class="ceo-title">CEO's</div>
            <div class="owner-name">سید محمد رضا شاہ</div>
          </div>

          <!-- Existing content continues here -->
          <h1>Defaulter Lists for ${selectedMonth}</h1>
          <p>Area: ${areas.find(a => a._id === selectedArea)?.name || selectedArea}</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Connection Number</th>
                <th>Unpaid Months</th>
                <th>Accumulated Balance</th>
                <th>Pending / Balance Due</th> <!-- Added header for current month's balance -->
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Defaulter Lists</h1>
        <p className="text-gray-600">Monthly lists of persons who haven't paid their fees</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Area and Month</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Area</label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
            >
              <option value="">-- Select Area --</option>
              {areas.map((area) => (
                <option key={area._id} value={area._id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
            />
          </div>

          <div className="flex items-center">
            <button
              onClick={printDefaulters}
              disabled={defaulters.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading defaulters...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Defaulters for {selectedMonth}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connection Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unpaid Months</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accumulated Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending / Balance Due</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {defaulters.map((d) => (
                  <tr key={d.personId} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{d.personName}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{d.connectionNumber || '-'}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{d.unpaidMonths}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">Rs.{d.accumulatedBalance.toFixed(2)}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">Rs.{d.currentMonthBalance.toFixed(2)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}