"use client";
// debit not page created still settings needed to be made in that page
import React, { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function CashReceivedPage() {
	const [db, setDb] = useState<any>(null);
	const [areas, setAreas] = useState<any[]>([]);
	const [selectedArea, setSelectedArea] = useState("");
	const [personsInArea, setPersonsInArea] = useState<any[]>([]);
	const [selectedPersonId, setSelectedPersonId] = useState("");
	const [selectedPersonName, setSelectedPersonName] = useState("");
	const [selectedPersonAddress, setSelectedPersonAddress] = useState("");
	const [selectedPersonFee, setSelectedPersonFee] = useState<number | "">("");
	const [selectedPersonCreatedAt, setSelectedPersonCreatedAt] = useState<string | null>(null);
	const [selectedMonth, setSelectedMonth] = useState("");
	const [amount, setAmount] = useState<number | "">("");
	const [records, setRecords] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [connectionQuery, setConnectionQuery] = useState("");
	const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
	const [areaQuery, setAreaQuery] = useState("");
	const [areaSuggestions, setAreaSuggestions] = useState<any[]>([]);

	// Computed rows for display in table (one per person for selected month)
const [displayRows, setDisplayRows] = useState<any[]>([]);

// Helper to get month string from date (YYYY-MM)
const getMonthString = (date: Date) => date.toISOString().slice(0, 7);

// Helper to get previous month (YYYY-MM)
const getPreviousMonth = (month: string) => {
  const [year, mon] = month.split('-').map(Number);
  const prevDate = new Date(year, mon - 1, 1); // Subtract 1 month
  prevDate.setMonth(prevDate.getMonth() - 1);
  return getMonthString(prevDate);
};

// Compute display rows when area or month changes
useEffect(() => {
  if (!selectedArea || personsInArea.length === 0) {
    setDisplayRows([]);
    return;
  }

  const rows = personsInArea.map((person) => {
    const monthlyFee = Number(person.amount || 0);
    const personRecords = records.filter((r: any) => r.personId === person._id);

    const startMonth = getMonthString(new Date(person.createdAt || new Date()));

    // Decide last month to calculate till
    let endMonth: string;
    if (selectedMonth) {
      endMonth = selectedMonth;
    } else {
      const today = new Date();
      const currentMonthStr = getMonthString(today);
      endMonth = getPreviousMonth(currentMonthStr);
    }

    const totalMonths = calculateMonthsBetween(startMonth, endMonth);
    const totalExpected = monthlyFee * totalMonths;

    const totalPaid = personRecords
      .filter((r: any) => {
        const rMonth = r.month || getMonthString(new Date(r.createdAt));
        return rMonth <= endMonth;
      })
      .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

    const pending = Math.max(0, totalExpected - totalPaid);

    // amount paid ONLY in selected month
    let paidThisMonth = 0;
    if (selectedMonth) {
      paidThisMonth = personRecords
        .filter((r: any) => r.month === selectedMonth)
        .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
    }

    return {
      _id: person._id + "_computed_" + (selectedMonth || "all"),
      personId: person._id,
      personName: person.name,
      connectionNumber: person.connectionNumber || "-",
      personAddress: person.address || "-",
      personMonthlyFee: monthlyFee,
      month: selectedMonth || "Up to now",
      amount: paidThisMonth,
      remainingAfterPayment: pending,
      isComputed: paidThisMonth === 0,
    };
  });

  setDisplayRows(rows);
}, [selectedArea, selectedMonth, personsInArea, records]);


// Helper function to calculate number of months between two YYYY-MM strings
const calculateMonthsBetween = (start: string, end: string) => {
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;  // Inclusive
};

	useEffect(() => {
		const setup = async () => {
			const pouch = await initDB();
			if (!pouch) return;
			setDb(pouch);
			try {
				const a = await pouch.getAreas();
				setAreas(a || []);
			} catch (e) {
				console.warn("failed to load areas", e);
			}
			setLoading(false);
		};
		setup();
	}, []);

	const onAreaChange = async (areaId: string) => {
		setSelectedArea(areaId);
		setSelectedPersonId("");
		setSelectedPersonName("");
		setSelectedPersonAddress("");
		setSelectedPersonFee("");
		setRecords([]);
		setConnectionQuery("");
		setConnectionSuggestions([]);
		if (!db || !areaId) return;
		try {
			const p = await db.getPersonsByArea(areaId);
			setPersonsInArea(p || []);
			await loadRecords(areaId);
		} catch (e) {
			console.warn("failed to load persons/records", e);
		}
	};

	const onPersonSelect = (personId: string) => {
		setSelectedPersonId(personId);
		const person = personsInArea.find((x) => x._id === personId);
		if (person) {
			setSelectedPersonName(person?.name || "");
			setSelectedPersonAddress(person?.address || "");
			setSelectedPersonFee(person?.amount || "");
			setSelectedPersonCreatedAt(person?.createdAt ?? null);
			setConnectionQuery(person ? String(person.connectionNumber ?? person.number ?? person.name ?? "") : "");
			setConnectionSuggestions([]);
			
			// Auto-fill amount with monthly fee if available
			if (person.amount && !amount) {
				setAmount(person.amount);
			}
		}
	};

	const loadRecords = async (areaId: string) => {
		if (!db) return;
		try {
			await db.localDB.createIndex({ index: { fields: ["type", "areaId"] } });
			const res = await db.localDB.find({ selector: { type: "debit", areaId } });
			setRecords(res.docs || []);
		} catch (e) {
			console.warn("failed to load records", e);
		}
	};
// wokring version
	// const addRecord = async () => {
	// 	if (!db) return;
	// 	if (!selectedArea) {
	// 		alert("Please select an area");
	// 		return;
	// 	}
	// 	if (!selectedPersonId) {
	// 		alert("Please select a connection number (person)");
	// 		return;
	// 	}
	// 	if (!selectedMonth) {
	// 		alert("Please choose a month");
	// 		return;
	// 	}
	// 	if (amount === "" || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
	// 		alert("Please enter a valid amount");
	// 		return;
	// 	}

	// 	const doc: any = {
	// 		_id: `debit_${selectedArea}_${selectedPersonId}_${Date.now()}`,
	// 		type: "debit",
	// 		areaId: selectedArea,
	// 		personId: selectedPersonId,
	// 		personName: selectedPersonName,
	// 		personAddress: selectedPersonAddress, // Save address in record
	// 		personMonthlyFee: selectedPersonFee, // Save monthly fee in record
	// 		connectionNumber: connectionQuery, // Save connection number
	// 		month: selectedMonth,
	// 		amount: Number(amount),
	// 		createdAt: new Date().toISOString(),
	// 	};

	// 	try {
	// 		await db.localDB.put(doc);
	// 		await loadRecords(selectedArea);
	// 		setAmount("");
	// 		setSelectedMonth("");
	// 	} catch (e: any) {
	// 		console.error("failed to save record", e);
	// 		alert(e?.message || "Failed to save record");
	// 	}
	// };
// new test version start for add record 
const addRecord = async () => {
  if (!db || !selectedPersonId) return;

  if (!selectedMonth) {
    alert("Please select a month");
    return;
  }
  if (amount === "" || Number(amount) <= 0) {
    alert("Please enter a valid amount");
    return;
  }

  try {
    // 1. Get current person document
    const person = personsInArea.find(p => p._id === selectedPersonId);
    if (!person) return;

    const monthlyFee = Number(person.amount || selectedPersonFee || 0);
    const currentRemaining = Number(person.remainingBalance || 0);

    // 2. Calculate new expected amount (monthly fee + carry forward)
    const expectedThisMonth = monthlyFee + currentRemaining;

    // 3. Calculate new remaining balance after this payment
    const newRemainingBalance = expectedThisMonth - Number(amount);

    // 4. Update the person document with new running balance
    const updatedPerson = {
      ...person,
      remainingBalance: Math.max(0, newRemainingBalance),   // prevent negative
      lastPaymentDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.localDB.put(updatedPerson);   // Update person record

    // 5. Save the debit/payment record
    const doc = {
      _id: `debit_${selectedArea}_${selectedPersonId}_${Date.now()}`,
      type: "debit",
      areaId: selectedArea,
      personId: selectedPersonId,
      personName: selectedPersonName,
      personAddress: selectedPersonAddress,
      personMonthlyFee: monthlyFee,
      connectionNumber: connectionQuery,
      month: selectedMonth,
      amount: Number(amount),
      expectedAmount: expectedThisMonth,        // ← New: store expected
      remainingAfterPayment: newRemainingBalance, // ← New: store remaining
      createdAt: new Date().toISOString(),
    };

    await db.localDB.put(doc);

    // 6. Refresh data
    await loadRecords(selectedArea);
    await onAreaChange(selectedArea); // Refresh persons list to update remainingBalance

    // Reset form
    setAmount("");
    setSelectedMonth("");

    alert("Payment recorded successfully!");
  } catch (e: any) {
    console.error(e);
    alert("Failed to save payment: " + e.message);
  }
};
// new test version end for add record 
	const deleteRecord = async (r: any) => {
		if (!db) return;
		try {
			await db.localDB.remove(r);
			await loadRecords(selectedArea);
		} catch (e) {
			console.warn("failed to delete record", e);
		}
	};

	// compute pending and all-time balance for selected person
	const toMonth = (dStr?: string | null) => {
		if (!dStr) return null;
		try {
			const d = new Date(dStr);
			if (Number.isNaN(d.getTime())) return null;
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		} catch (e) {
			return null;
		}
	};

	const selectedPersonRecords = selectedPersonId
		? records.filter((r: any) => r.personId === selectedPersonId)
		: [];

	const paidInSelectedMonth = selectedMonth
		? selectedPersonRecords
			.filter((r: any) => {
				const m = r.month || toMonth(r.createdAt);
				return m === selectedMonth;
			})
			.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
		: 0;

	const expectedPerMonth = Number(selectedPersonFee) || 0;
	const selectedPendingAmount = selectedMonth ? Math.max(0, expectedPerMonth - paidInSelectedMonth) : 0;

	// all-time: determine person start (createdAt) or earliest payment
	const earliestRecordDate = selectedPersonRecords.reduce((min: string | null, r: any) => {
		if (!r.createdAt) return min;
		const d = new Date(r.createdAt);
		if (!min) return d.toISOString();
		return new Date(min) > d ? d.toISOString() : min;
	}, null as string | null);

	const startDate = selectedPersonCreatedAt ? new Date(selectedPersonCreatedAt) : earliestRecordDate ? new Date(earliestRecordDate) : null;

	const monthsBetween = (start?: Date | null, end: Date = new Date()) => {
		if (!start) return 1;
		const sy = start.getFullYear();
		const sm = start.getMonth();
		const ey = end.getFullYear();
		const em = end.getMonth();
		return (ey - sy) * 12 + (em - sm) + 1;
	};

	const monthsCount = monthsBetween(startDate, new Date());
	const totalExpectedAllTime = expectedPerMonth * monthsCount;
	const totalPaidAllTime = selectedPersonRecords.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
	const allTimeBalance = totalExpectedAllTime - totalPaidAllTime;

	const filteredRecords = selectedMonth
  ? records.filter((r: any) => r.month === selectedMonth)
  : records;

	// const printRecords = () => {
	// 	const printWindow = window.open('', '', 'width=1200,height=600');
	// 	if (!printWindow) return;

	// 	const tableHTML = `
	// 		<!DOCTYPE html>
	// 		<html>
	// 		<head>
	// 			<title>Family Cable Network - Records</title>
	// 			<style>
	// 				* { margin: 0; padding: 0; }
	// 				body { font-family: Arial, sans-serif; padding: 20px; }
	// 				h1 { text-align: center; margin-bottom: 20px; font-size: 24px; }
	// 				table { width: 100%; border-collapse: collapse; margin-top: 20px; }
	// 				thead { background-color: #f3f4f6; }
	// 				th { padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #d1d5db; font-size: 12px; }
	// 				td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
	// 				tr:hover { background-color: #f9fafb; }
	// 			</style>
	// 		</head>
	// 		<body>
	// 			<h1>Family Cable Network</h1>
	// 			<table>
	// 				<thead>
	// 					<tr>
	// 						<th>Person</th>
	// 						<th>Connection #</th>
	// 						<th>Address</th>
	// 						<th>Monthly Fee</th>
	// 						<th>Month</th>
	// 						<th>Amount Received</th>
							
	// 					</tr>
	// 				</thead>
	// 				<tbody>
	// 					${records.map((r) => `
	// 						<tr>
	// 							<td>${r.personName}</td>
	// 							<td>${r.connectionNumber || '-'}</td>
	// 							<td>${r.personAddress || '-'}</td>
	// 							<td>$${Number(r.personMonthlyFee).toFixed(2)}</td>
	// 							<td>${r.month}</td>
	// 							<td>$${Number(r.amount).toFixed(2)}</td>
	// 						</tr>
	// 					`).join('')}
	// 				</tbody>
	// 			</table>
	// 			<script>
	// 				window.print();
	// 			</script>
	// 		</body>
	// 		</html>
	// 	`;

	// 	printWindow.document.write(tableHTML);
	// 	printWindow.document.close();
	// };
	const printRecords = () => {
  const printWindow = window.open('', '', 'width=1200,heisght=600');
  if (!printWindow) return;

  const tableHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Family Cable Network - Records</title>
      <style>
        * { margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; margin-bottom: 20px; font-size: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        thead { background-color: #f3f4f6; }
        th { padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #d1d5db; font-size: 12px; }
        td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
        tr:hover { background-color: #f9fafb; }
        .amount { text-align: right; }
        .pending { color: #dc2626; font-weight: bold; text-align: right; }
      </style>
    </head>
    <body>
      <h1>Family Cable Network</h1>
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Connection #</th>
            <th>Address</th>
            <th>Monthly Fee</th>
            <th>Month</th>
            <th class="amount">Amount Received</th>
            <th class="amount">Pending / Balance Due</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((r) => `
            <tr>
              <td>${r.personName || '-'}</td>
              <td>${r.connectionNumber || '-'}</td>
              <td>${r.personAddress || '-'}</td>
              <td class="amount">Rs.${Number(r.personMonthlyFee ?? 0).toFixed(2)}</td>
              <td>${r.month || '-'}</td>
              <td class="amount">Rs.${Number(r.amount ?? 0).toFixed(2)}</td>
              <td class="pending">Rs.${Number(r.remainingAfterPayment ?? 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <script>
        window.print();
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(tableHTML);
  printWindow.document.close();
};

	if (loading)
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-50">
				<div className="text-lg text-gray-600">Loading...</div>
			</div>
		);

	return (
		<div className="min-h-screen bg-gray-50 p-6">
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-black">Cash Received From Customer</h1>
				<p className="text-sm text-gray-600">Enter received amounts per person and month</p>
			</div>

			<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
				<div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
					<div className="md:col-span-1">
						<label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
						<div className="relative">
							<input
								type="text"
								value={areaQuery}
								onChange={(e) => {
									const q = String(e.target.value || "");
									setAreaQuery(q);
									if (!q) {
										setAreaSuggestions([]);
										return;
									}
									const qLower = q.toLowerCase();
									const filtered = areas.filter((ar) => String(ar.name || "").toLowerCase().startsWith(qLower));
									setAreaSuggestions(filtered.slice(0, 20));
								}}
								placeholder="Type area name (e.g. K for Karachi)"
								className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
							/>
							{areaSuggestions.length > 0 && (
								<ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded max-h-44 overflow-auto shadow-lg">
									{areaSuggestions.map((a) => (
										<li
											key={a._id}
											onClick={() => {
												setAreaQuery(a.name || "");
												setAreaSuggestions([]);
												onAreaChange(a._id);
											}}
											className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-black"
										>
											{a.name}
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">Connection No</label>
						<div className="relative">
							<input
								type="text"
								value={connectionQuery}
								onChange={(e) => {
									const q = String(e.target.value || "");
									setConnectionQuery(q);
									if (!q) {
										setConnectionSuggestions([]);
										return;
									}
									const qLower = q.toLowerCase();
									const filtered = personsInArea.filter((p) => {
										const conn = String(p.connectionNumber ?? p.number ?? p.name ?? "");
										return conn.toLowerCase().startsWith(qLower);
									});
									setConnectionSuggestions(filtered.slice(0, 20));
								}}
								placeholder="Type connection # (e.g. 1)"
								className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
							/>

							{connectionSuggestions.length > 0 && (
								<ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded max-h-44 overflow-auto shadow-lg">
									{connectionSuggestions.map((p) => {
										const label = p.connectionNumber ?? p.number ?? p.name ?? "";
										return (
											<li
												key={p._id}
												onClick={() => onPersonSelect(p._id)}
												className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-black"
											>
												{label}
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">Person Name</label>
						<input 
  type="text" 
  value={selectedPersonName}
  onChange={(e) => setSelectedPersonName(e.target.value)}
  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black" 
/>

					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
						<input 
  type="text" 
  value={selectedPersonAddress}
  onChange={(e) => setSelectedPersonAddress(e.target.value)}
  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black" 
/>

					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">Monthly Fee</label>
						<input 
							type="text" 
							value={selectedPersonFee === "" ? "" : `$${Number(selectedPersonFee).toFixed(2)}`} 
							readOnly 
							className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black" 
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1 items-end">
				<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>

  <input 
    type="month" 
    value={selectedMonth} 
    onChange={(e) => setSelectedMonth(e.target.value)} 
    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black" 
  />
</div>


					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">Amount Received</label>

<input 
  type="number" 
  value={amount === "" ? "" : amount} 
  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} 
  placeholder="0.00" 
  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black" 
/>

				</div>

				<div className="flex items-end gap-2">
					<button 
  onClick={addRecord} 
  className="px-4 py-3 flex-1 bg-gradient-to-r from-blue-600 to-purple-700 text-white text-sm rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200"
>
  Add Record
</button>
					<button 
  onClick={printRecords} 
  className="px-4 py-3 flex-1 bg-gradient-to-r from-green-600 to-teal-700 text-white text-sm rounded-lg hover:from-green-700 hover:to-teal-800 transition-colors duration-200"
>
  Print
</button>

				</div>
				</div>

				{selectedPersonId && (
					<div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
						{selectedMonth && (
							<div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
								<div className="text-xs text-gray-600">Pending for {selectedMonth}</div>
								<div className="text-lg font-semibold text-red-600">${Number(selectedPendingAmount).toFixed(2)}</div>
								<div className="text-sm text-gray-600 mt-1">
									Expected per month: ${Number(expectedPerMonth).toFixed(2)} — Paid: ${Number(paidInSelectedMonth).toFixed(2)}
								</div>
							</div>
						)}

						<div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
							<div className="text-xs text-gray-600">All-time balance</div>
							<div className="text-lg font-semibold text-black">${Number(allTimeBalance).toFixed(2)}</div>
						</div>
					</div>
				)}
			</div>
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-lg font-semibold">
      Records
      {selectedMonth && (
        <span className="text-sm font-normal text-gray-500 ml-2">
          (for {new Date(selectedMonth + "-01").toLocaleString('default', { month: 'long', year: 'numeric' })})
        </span>
      )}
    </h2>
    
    {displayRows.length > 0 && (
      <button
        onClick={printRecords}
        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
      >
        Print Monthly list
      </button>
    )}
  </div>

  {displayRows.length === 0 ? (
    <div className="text-sm text-gray-500">No records for selected area</div>
  ) : (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Person</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Connection #</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Fee</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount Received</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending / Balance Due</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayRows.map((row: any) => (
            <tr key={row._id} className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900">{row.personName}</td>
              <td className="px-6 py-3 text-sm text-gray-900">{row.connectionNumber || '-'}</td>
              <td className="px-6 py-3 text-sm text-gray-500">{row.personAddress || '-'}</td>
              <td className="px-6 py-3 text-sm text-gray-500">
                Rs.{Number(row.personMonthlyFee).toFixed(2)}
              </td>
              <td className="px-6 py-3 text-sm text-gray-500">{row.month || '-'}</td>
              <td className="px-6 py-3 text-sm text-gray-900 font-medium">
                Rs.{Number(row.amount).toFixed(2)}
              </td>
              <td className="px-6 py-3 text-sm text-red-600 font-semibold">
                Rs.{Number(row.remainingAfterPayment).toFixed(2)}
              </td>
              <td className="px-6 py-3 text-sm">
                {!row.isComputed && (
                  <button
                    onClick={() => deleteRecord(row)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition-colors duration-200"
                  >
                    Delete
                  </button>
                )}
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