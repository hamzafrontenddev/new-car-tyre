import React, { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarIcon } from "@heroicons/react/24/outline";

const filterByDateRange = (data, start, end) => {
  if (!start || !end) return data;
  return data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
};

const Transfer = () => {
  const [form, setForm] = useState({
    company: "",
    brand: "",
    model: "",
    size: "",
    quantity: "",
    date: new Date().toISOString().split("T")[0],
    storeQuantity: "",
    shopQuantity: "",
  });
  const [purchasedTyres, setPurchasedTyres] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [viewTransfer, setViewTransfer] = useState(null);
  const itemsPerPage = 5;

  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [availableSizes, setAvailableSizes] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "purchasedTyres"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPurchasedTyres(data);
      setAvailableCompanies([...new Set(data.map((t) => t.company?.toLowerCase()))]);
    });

    const unsub2 = onSnapshot(collection(db, "transferredTyres"), (snapshot) => {
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data = filterByDateRange(data, startDate, endDate);
      setTransfers(data);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [startDate, endDate]);

  const handleCompanyChange = async (e) => {
    const company = e.target.value.trim();
    setForm((prev) => ({
      ...prev,
      company,
      brand: "",
      model: "",
      size: "",
      quantity: "",
      storeQuantity: "",
      shopQuantity: "",
    }));

    const brands = purchasedTyres
      .filter((t) => t.company?.toLowerCase() === company.toLowerCase())
      .map((t) => t.brand);

    if (brands.length === 0 && company) {
      toast.error("This company is not available");
      setAvailableBrands([]);
      setAvailableModels([]);
      setAvailableSizes([]);
      return;
    }

    setAvailableBrands([...new Set(brands)]);
    setAvailableModels([]);
    setAvailableSizes([]);
  };

  const handleBrandChange = (e) => {
    const brand = e.target.value.trim();
    setForm((prev) => ({
      ...prev,
      brand,
      model: "",
      size: "",
      quantity: "",
      storeQuantity: "",
      shopQuantity: "",
    }));

    const models = purchasedTyres
      .filter(
        (t) =>
          t.company?.toLowerCase() === form.company.toLowerCase() &&
          t.brand?.toLowerCase() === brand.toLowerCase()
      )
      .map((t) => t.model);

    if (models.length === 0 && brand) {
      toast.error("This brand is not available for selected company");
      setAvailableModels([]);
      setAvailableSizes([]);
      return;
    }

    setAvailableModels([...new Set(models)]);
    setAvailableSizes([]);
  };

  const handleModelChange = (e) => {
    const model = e.target.value.trim();
    setForm((prev) => ({
      ...prev,
      model,
      size: "",
      quantity: "",
      storeQuantity: "",
      shopQuantity: "",
    }));

    const matches = purchasedTyres.filter(
      (t) =>
        t.company?.toLowerCase() === form.company.toLowerCase() &&
        t.brand?.toLowerCase() === form.brand.toLowerCase() &&
        t.model?.toLowerCase() === model.toLowerCase()
    );

    if (matches.length > 0) {
      const uniqueSizes = [...new Set(matches.map((t) => t.size))];
      setAvailableSizes(uniqueSizes);
    } else {
      setAvailableSizes([]);
    }
  };

  const handleSizeChange = async (e) => {
    const size = e.target.value.trim();
    setForm((prev) => ({
      ...prev,
      size,
      quantity: "",
      storeQuantity: "",
      shopQuantity: "",
    }));

    const purchasedQuery = query(
      collection(db, "purchasedTyres"),
      where("company", "==", form.company),
      where("brand", "==", form.brand),
      where("model", "==", form.model),
      where("size", "==", size)
    );
    const purchasedSnapshot = await getDocs(purchasedQuery);
    const purchasedTyresData = purchasedSnapshot.docs.map((doc) => doc.data());
    const totalStoreQty = purchasedTyresData.reduce((acc, curr) => acc + (parseInt(curr.store) || 0), 0);
    const totalShopQty = purchasedTyresData.reduce((acc, curr) => acc + (parseInt(curr.shop) || 0), 0);
    setForm((prev) => ({
      ...prev,
      storeQuantity: totalStoreQty.toString(),
      shopQuantity: totalShopQty.toString(),
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransfer = async () => {
    if (!form.company || !form.brand || !form.model || !form.size || !form.quantity || !form.date) {
      toast.error("Please fill all fields");
      return;
    }

    const transferQty = parseInt(form.quantity);
    if (transferQty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const purchasedQuery = query(
      collection(db, "purchasedTyres"),
      where("company", "==", form.company),
      where("brand", "==", form.brand),
      where("model", "==", form.model),
      where("size", "==", form.size)
    );
    const purchasedSnapshot = await getDocs(purchasedQuery);
    const purchasedTyresData = purchasedSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (purchasedTyresData.length === 0) {
      toast.error("No matching tyre found in purchasedTyres");
      return;
    }

    const totalStoreQty = purchasedTyresData.reduce((acc, curr) => acc + (parseInt(curr.store) || 0), 0);
    if (transferQty > totalStoreQty) {
      toast.error(`Only ${totalStoreQty} tyres available in store`);
      return;
    }

    // Update quantities
    let remainingQty = transferQty;
    for (const tyre of purchasedTyresData) {
      if (remainingQty <= 0) break;
      const currentStore = parseInt(tyre.store) || 0;
      const currentShop = parseInt(tyre.shop) || 0;
      const deductQty = Math.min(currentStore, remainingQty);

      if (deductQty > 0) {
        await updateDoc(doc(db, "purchasedTyres", tyre.id), {
          store: currentStore - deductQty,
          shop: currentShop + deductQty,
        });
        console.log(`Transferred ${deductQty} from store to shop for tyre ID: ${tyre.id}`);
        remainingQty -= deductQty;
      }
    }

    // Log transfer
    const transferData = {
      company: form.company,
      brand: form.brand,
      model: form.model,
      size: form.size,
      quantity: transferQty,
      date: form.date,
      createdAt: new Date(),
    };

    try {
      await addDoc(collection(db, "transferredTyres"), transferData);
      toast.success(`Transferred ${transferQty} tyres from store to shop`);
      setForm({
        company: "",
        brand: "",
        model: "",
        size: "",
        quantity: "",
        date: new Date().toISOString().split("T")[0],
        storeQuantity: "",
        shopQuantity: "",
      });
      setAvailableBrands([]);
      setAvailableModels([]);
      setAvailableSizes([]);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Transfer failed");
    }
  };

  const filteredTransfers = transfers.filter((t) =>
    `${t.company} ${t.brand} ${t.model} ${t.size}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTransfers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">🔄 Transfer Store to Shop</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <select
          name="company"
          value={form.company}
          onChange={handleCompanyChange}
          className="border border-gray-300 p-2 rounded w-full"
        >
          <option value="">Select Company</option>
          {availableCompanies.map((company, idx) => (
            <option key={idx} value={company}>{company}</option>
          ))}
        </select>
        <select
          name="brand"
          value={form.brand}
          onChange={handleBrandChange}
          className="border border-gray-300 p-2 rounded w-full"
        >
          <option value="">Select Brand</option>
          {availableBrands.map((brand, idx) => (
            <option key={idx} value={brand}>{brand}</option>
          ))}
        </select>
        <select
          name="model"
          value={form.model}
          onChange={handleModelChange}
          className="border border-gray-300 p-2 rounded w-full"
        >
          <option value="">Select Model</option>
          {availableModels.map((model, idx) => (
            <option key={idx} value={model}>{model}</option>
          ))}
        </select>
        <select
          name="size"
          value={form.size}
          onChange={handleSizeChange}
          className="border border-gray-300 p-2 rounded w-full"
        >
          <option value="">Select Size</option>
          {availableSizes.map((size, idx) => (
            <option key={idx} value={size}>{size}</option>
          ))}
        </select>
        <input
          type="number"
          name="quantity"
          placeholder="Transfer Quantity"
          value={form.quantity}
          onChange={handleChange}
          className="border border-gray-300 p-2 rounded w-full"
        />
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          className="border border-gray-300 p-2 rounded w-full"
        />
        <input
          type="number"
          name="storeQuantity"
          placeholder="Store Quantity"
          value={form.storeQuantity}
          readOnly
          className="border border-gray-300 p-2 rounded w-full bg-gray-100"
        />
        <input
          type="number"
          name="shopQuantity"
          placeholder="Shop Quantity"
          value={form.shopQuantity}
          readOnly
          className="border border-gray-300 p-2 rounded w-full bg-gray-100"
        />
        <button
          onClick={handleTransfer}
          className="bg-blue-600 text-white font-semibold rounded px-6 py-2 hover:bg-blue-700 transition"
        >
          Transfer
        </button>
      </div>

      <div className="flex justify-between items-center">
        <input
          type="text"
          placeholder="🔍 Search by company, brand, model, size..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 border border-gray-300 rounded px-3 py-2"
        />
        <div className="flex gap-2 mb-4">
          <div className="relative">
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              placeholderText="Start Date"
              className="border pl-10 pr-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              dateFormat="dd/MM/yyyy"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <div className="relative">
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              placeholderText="End Date"
              className="border pl-10 pr-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              dateFormat="dd/MM/yyyy"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 font-semibold">Company</th>
              <th className="py-2 px-4 font-semibold">Brand</th>
              <th className="py-2 px-4 font-semibold">Model</th>
              <th className="py-2 px-4 font-semibold">Size</th>
              <th className="py-2 px-4 font-semibold">Quantity</th>
              <th className="py-2 px-4 font-semibold">Date</th>
              <th className="py-2 px-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((t) => (
                <tr key={t.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-2 px-4">{t.company}</td>
                  <td className="py-2 px-4">{t.brand}</td>
                  <td className="py-2 px-4">{t.model}</td>
                  <td className="py-2 px-4">{t.size}</td>
                  <td className="py-2 px-4">{t.quantity}</td>
                  <td className="py-2 px-4">{t.date}</td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => setViewTransfer(t)}
                      className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center p-6 text-gray-500">
                  No transfers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="p-4 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
            <button
              key={number}
              onClick={() => paginate(number)}
              className={`px-3 py-1 rounded ${
                currentPage === number ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {number}
            </button>
          ))}
        </div>
      </div>

      {viewTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-8 relative font-sans">
            <header className="flex justify-between items-center border-b border-gray-200 pb-4 mb-6">
              <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                <span role="img" aria-label="Transfer">🔄</span> Transfer Details
              </h2>
              <p className="text-sm text-gray-500">Date: <time>{viewTransfer.date}</time></p>
            </header>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-gray-700 text-sm leading-relaxed mb-8">
              <div>
                <h3 className="font-semibold text-lg mb-3 text-gray-900 border-b border-gray-300 pb-1">Tyre Details</h3>
                <p><span className="font-medium text-gray-800">Company:</span> {viewTransfer.company}</p>
                <p><span className="font-medium text-gray-800">Brand:</span> {viewTransfer.brand}</p>
                <p><span className="font-medium text-gray-800">Model:</span> {viewTransfer.model}</p>
                <p><span className="font-medium text-gray-800">Size:</span> {viewTransfer.size}</p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3 text-gray-900 border-b border-gray-300 pb-1">Transfer Details</h3>
                <p><span className="font-medium text-gray-800">Quantity:</span> {viewTransfer.quantity}</p>
                <p><span className="font-medium text-gray-800">Date:</span> {viewTransfer.date}</p>
              </div>
            </section>

            <footer className="flex justify-end items-center text-gray-600 text-sm">
              <button
                onClick={() => setViewTransfer(null)}
                className="bg-red-600 hover:bg-red-700 transition text-white px-5 py-2 rounded-md shadow"
              >
                ❌ Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transfer;