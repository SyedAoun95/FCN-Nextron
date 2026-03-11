// src/app/services/db.ts
export const initDB = async () => {
  if (typeof window === "undefined") return null; // only run in browser

  const PouchDB = (await import("pouchdb-browser")).default;
  const PouchDBFind = (await import("pouchdb-find")).default;

  PouchDB.plugin(PouchDBFind);

  const localDB = new PouchDB("crud-database");
  const remoteDB = new PouchDB(
    "http://admin:512141@127.0.0.1:5984/db_fcn"
  );

  // ---------------------------
  // LIVE TWO-WAY SYNC
  // ---------------------------
  const syncDB = () => {
    localDB
      .sync(remoteDB, { live: true, retry: true })
      .on("change", (info) => console.log("DB Change:", info))
      .on("paused", () => console.log("Sync paused"))
      .on("active", () => console.log("Sync active"))
      .on("error", (err) => console.error("Sync error:", err));
  };

  // ---------------------------
  // REAL-TIME CHANGES LISTENER
  // ---------------------------
  const listenChanges = (onChange: (doc: any) => void) => {
    const changes = localDB
      .changes({
        since: "now",
        live: true,
        include_docs: true,
      })
      .on("change", (change) => {
        if (change.deleted) {
          onChange({ ...change.doc, _deleted: true });
        } else {
          onChange(change.doc);
        }
      });

    return changes;
  };

  // ---------------------------
  // AREA CRUD
  // ---------------------------
  const createArea = async (name: string) => {
    if (!name.trim()) throw new Error("Area name cannot be empty");

    const doc: any = {
      _id: `area_${name.toLowerCase()}_${Date.now()}`,
      type: "area",
      name,
      createdAt: new Date().toISOString(),
    };

    return localDB.put(doc);
  };

  const getAreas = async () => {
    await localDB.createIndex({ index: { fields: ["type"] } });
    const res = await localDB.find({ selector: { type: "area" } });
    return res.docs;
  };

  const deleteArea = async (area: any) => {
    return localDB.remove(area);
  };

  // ---------------------------
  // PERSON CRUD
  // ---------------------------
  const createPerson = async (
  name: string,
  areaId: string,
  connectionNumber?: string,
  amount?: number,          // monthly fee
  address?: string,
  amountPaid: number = 0,   // new parameter with default 0
  remainingBalance?: number // new parameter (optional, but we'll calculate it)
) => {
  if (!name.trim() || !areaId) throw new Error("Invalid input");

  const conn = connectionNumber !== undefined ? String(connectionNumber).trim() : "";

  if (!conn) {
    throw new Error('Connection number is required for a person');
  }

  // Ensure uniqueness of connectionNumber across persons
  await localDB.createIndex({ index: { fields: ['type', 'connectionNumber'] } });
  const existing = await localDB.find({ selector: { type: 'person', connectionNumber: conn } });
  if (existing.docs && existing.docs.length > 0) {
    throw new Error('Connection number already assigned to another person');
  }

  // Calculate remainingBalance if not provided (fallback)
  const monthlyFeeNum = Number(amount || 0);
  const paidNum = Number(amountPaid || 0);
  const calculatedRemaining = monthlyFeeNum - paidNum;

  const doc: any = {
    _id: `person_${areaId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: "person",
    name: name.trim(),
    areaId,
    connectionNumber: conn,
    amount: monthlyFeeNum,                    // monthly fee
    address: address?.trim() || '-',          // safe default
    amountPaid: paidNum,                      // initial payment
    remainingBalance: Number(remainingBalance ?? calculatedRemaining),  // ← THIS IS THE FIX
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  return localDB.put(doc);
};

  const getPersonsByArea = async (areaId: string) => {
    await localDB.createIndex({
      index: { fields: ["type", "areaId"] },
    });

    const res = await localDB.find({
      selector: { type: "person", areaId },
    });

    return res.docs;
  };

  const updatePerson = async (person: any, updates: any) => {
    if (!person._id || !person._rev)
      throw new Error("_id and _rev required");
    const updatedDoc = { ...person, ...updates, updatedAt: new Date().toISOString() };
    return localDB.put(updatedDoc);
  };

  const deletePerson = async (person: any) => {
  try {
    // Step 1: Delete the person document itself
    await localDB.remove(person);

    // Step 2: Find all debit records linked to this person
    const debitsResult = await localDB.find({
      selector: {
        type: "debit",
        personId: person._id
      }
    });

    const debits = debitsResult.docs || [];

    // Step 3: Delete each debit record one by one
    for (const debit of debits) {
      await localDB.remove(debit);
    }

    console.log(`Deleted person ${person._id} and ${debits.length} related debit records`);

    // Optional: return useful info (you can use it in the UI if you want)
    return { success: true, deletedDebits: debits.length };
  } catch (err: any) {
    console.error("Error during person deletion:", err);
    throw new Error("Failed to delete person: " + (err?.message || "Unknown error"));
  }
};
  // ---------------------------
  // AGGREGATION HELPERS
  // ---------------------------
  const totalConnections = async () => {
    await localDB.createIndex({ index: { fields: ['type', 'name', 'areaId'] } });
    const res = await localDB.find({
      selector: {
        type: 'person',
        name: { $exists: true },
        areaId: { $exists: true }
      }
    });
    return res.docs.length;
  };

  const getAllPersons = async () => {
    await localDB.createIndex({ index: { fields: ['type', 'name', 'areaId', 'amount', 'createdAt'] } });
    const res = await localDB.find({ selector: { type: 'person' } });
    return res.docs;
  };

  const grandTotalRevenue = async () => {
    await localDB.createIndex({ index: { fields: ['type', 'amount'] } });
    const res = await localDB.find({ selector: { type: 'person' } });
    return res.docs.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
  };

  const monthlyRevenue = async (year: number, month: number) => {
    await localDB.createIndex({ index: { fields: ['type', 'createdAt', 'amount'] } });
    const res = await localDB.find({ selector: { type: 'person' } });
    const total = res.docs.reduce((sum: number, d: any) => {
      if (!d.createdAt) return sum;
      const dt = new Date(d.createdAt);
      if (dt.getFullYear() === year && dt.getMonth() + 1 === month) {
        return sum + (Number(d.amount) || 0);
      }
      return sum;
    }, 0);
    return total;
  };

  const monthlyRevenueHistory = async (monthsBack = 12) => {
    await localDB.createIndex({ index: { fields: ['type', 'createdAt', 'amount'] } });
    const res = await localDB.find({ selector: { type: 'person' } });

    const map: Record<string, number> = {};
    const now = new Date();

    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = 0;
    }

    res.docs.forEach((d: any) => {
      if (!d.createdAt) return;
      const dt = new Date(d.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (map[key] !== undefined) {
        map[key] += (Number(d.amount) || 0);
      }
    });

    return Object.keys(map).map((k) => ({ month: k, total: map[k] }));
  };

  // ---------------------------
  // INTERNET ENTRY CRUD
  // ---------------------------
  const createInternetEntry = async (
    name: string,
    fatherName: string,
    cnic: string,
    phone: string,
    address: string,
    areaId: string,
    connectionNumber?: string,
    routerNo?: string,
    monthlyFee?: number,
    installationFee?: number,
    pendingAmount?: number
  ) => {
    if (!name.trim() || !areaId) throw new Error("Invalid input");

    const conn = connectionNumber !== undefined ? String(connectionNumber).trim() : "";
    const router = routerNo !== undefined ? String(routerNo).trim() : "";

    const doc: any = {
      _id: `internet_${areaId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: "internet-entry",
      name,
      fatherName,
      cnic,
      phone,
      address,
      areaId,
      connectionNumber: conn || null,
      routerNo: router || null,
      createdAt: new Date().toISOString(),
    };

    if (monthlyFee !== undefined && !Number.isNaN(Number(monthlyFee))) {
      doc.monthlyFee = Number(monthlyFee);
    }

    if (installationFee !== undefined && !Number.isNaN(Number(installationFee))) {
      doc.installationFee = Number(installationFee);
    }

    if (pendingAmount !== undefined && !Number.isNaN(Number(pendingAmount))) {
      doc.pendingAmount = Number(pendingAmount);
    }

    return localDB.put(doc);
  };

  const getInternetEntriesByArea = async (areaId: string) => {
    await localDB.createIndex({
      index: { fields: ["type", "areaId"] },
    });

    const res = await localDB.find({
      selector: { type: "internet-entry", areaId },
    });

    return res.docs;
  };

  const deleteInternetEntry = async (entry: any) => {
    return localDB.remove(entry);
  };

  // ---------------------------
  // SEARCH INTERNET ENTRIES (NAME, CNIC, OR CONNECTION NUMBER)
  // ---------------------------
  const searchInternetEntries = async (query: string) => {
    if (!query.trim()) return [];

    const q = query.toLowerCase();

    await localDB.createIndex({
      index: { fields: ["type", "name", "cnic", "connectionNumber"] },
    });

    const result = await localDB.find({
      selector: {
        type: "internet-entry",
        $or: [
          { name: { $regex: new RegExp(q, "i") } },
          { cnic: { $regex: new RegExp(q, "i") } },
          { connectionNumber: { $regex: new RegExp(q, "i") } },
        ],
      },
    });

    return result.docs;
  };

  // AUTOMATIC SYNC ON INIT
  syncDB();

  // ---------------------------
  // USER AUTH
  // ---------------------------
  const hashPassword = async (password: string): Promise<string> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch (error) {
      console.error("Error hashing password:", error);
      throw new Error("Failed to hash password");
    }
  };

  const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    try {
      const hashedInput = await hashPassword(password);
      return hashedInput === hashedPassword;
    } catch (error) {
      console.error("Error verifying password:", error);
      return false;
    }
  };

  const createUser = async (username: string, password: string, role: 'admin' | 'op') => {
    if (!username.trim() || !password.trim()) throw new Error("Invalid input");

    // Check if user exists
    const existing = await localDB.find({
      selector: { type: "user", username: username.toLowerCase() }
    });
    if (existing.docs.length > 0) throw new Error("User already exists");

    // Hash the password
    const hashedPassword = await hashPassword(password);

    const doc = {
      _id: `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: "user",
      username: username.toLowerCase(),
      password: hashedPassword, // Store hashed password
      role,
      createdAt: new Date().toISOString(),
    };

    return localDB.put(doc);
  };

  const getUser = async (username: string, password: string) => {
    const res = await localDB.find({
      selector: { type: "user", username: username.toLowerCase() }
    });
    if (res.docs.length === 0) return null;
    const user = res.docs[0] as any;

    // Verify the password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (isPasswordValid) {
      return { username: user.username, role: user.role };
    }
    return null;
  };

  const getAllUsers = async () => {
    const res = await localDB.find({ selector: { type: "user" } });
    return res.docs;
  };

  return {
    localDB,
    remoteDB,
    syncDB,
    listenChanges,
    createArea,
    getAreas,
    deleteArea,
    createPerson,
    getPersonsByArea,
    updatePerson,
    deletePerson,

    totalConnections,
    grandTotalRevenue,
    monthlyRevenue,
    monthlyRevenueHistory,
    getAllPersons,
    createInternetEntry,
    getInternetEntriesByArea,
    deleteInternetEntry,
    searchInternetEntries,
    createUser,
    getUser,
    getAllUsers,
  };
};
