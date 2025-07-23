import React, { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, doc, deleteDoc, getDocs, where, query, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarIcon } from "@heroicons/react/24/outline";

const filterByDateRange = (data, start, end) => {
  if (!start || !end) return data;
  return data.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
};

// Utility function to normalize company name (lowercase, no spaces)
const normalizeCompanyName = (name) => {
  return name.toLowerCase().replace(/\s+/g, '');
};

const BuyTyre = () => {
  const [tyres, setTyres] = useState([]);
  const [company, setCompany] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [store, setStore] = useState("");
  const [shop, setShop] = useState("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedTyre, setSelectedTyre] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [confirmModalIsOpen, setConfirmModalIsOpen] = useState(false);
  const [editModalIsOpen, setEditModalIsOpen] = useState(false);
  const [editTyre, setEditTyre] = useState(null);
  const [users, setUsers] = useState([]); // Store users for mapping company names
  const itemsPerPage = 5;

  useEffect(() => {
    // Fetch tyres
    const unsubTyres = onSnapshot(collection(db, "purchasedTyres"), (snapshot) => {
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data = filterByDateRange(data, startDate, endDate);
      data.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      setTyres(data);
      setBrands([...new Set(data.map((item) => item.brand))]);
      setModels([...new Set(data.map((item) => item.model))]);
      setSizes([...new Set(data.map((item) => item.size))]);
    });

    // Fetch companies and users
    const fetchCompanies = async () => {
      const q = query(collection(db, "users"), where("userType", "==", "Company"));
      const snapshot = await getDocs(q);
      const companyData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCompanies(companyData.map((company) => company.name));
      setUsers(companyData); // Store full user data for mapping
    };
    fetchCompanies();

    return () => unsubTyres();
  }, [startDate, endDate]);

  // Map normalized company name to original name from users
  const getOriginalCompanyName = (normalizedName) => {
    const user = users.find((u) => normalizeCompanyName(u.name) === normalizedName);
    return user ? user.name : normalizedName;
  };

  const validateForm = () => {
    if (!company || !brand || !model || !size || !price || !quantity || !date) {
      toast.error("Please fill all fields");
      return false;
    }
    if (Number(price) <= 0) {
      toast.error("Price must be greater than 0");
      return false;
    }
    if (Number(quantity) <= 0) {
      toast.error("Quantity must be greater than 0");
      return false;
    }
    if (Number(store) + Number(shop) !== Number(quantity)) {
      toast.error("Store and Shop quantities must sum to the total Quantity");
      return false;
    }
    if (Number(store) < 0 || Number(shop) < 0) {
      toast.error("Store and Shop quantities cannot be negative");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setConfirmModalIsOpen(true);
  };

  const confirmPurchase = async () => {
    const totalCost = Number(price) * Number(quantity);
    const invoiceNumber = `INV${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const normalizedCompany = normalizeCompanyName(company);
    const tyre = {
      company: normalizedCompany,
      brand,
      model,
      size,
      price: Number(price),
      quantity: Number(quantity),
      store: Number(store),
      shop: Number(shop),
      totalPrice: totalCost,
      date,
      invoiceNumber,
    };
    try {
      const docRef = await addDoc(collection(db, "purchasedTyres"), tyre);
      const tyreId = docRef.id;
      toast.success("Tyre purchase confirmed and saved successfully!");

      const narration = `${size || 'N/A'}_${brand || 'N/A'}_Qty_${quantity}_Rate_${price}`;
      await addDoc(collection(db, "companyLedgerEntries"), {
        companyName: normalizedCompany,
        brand: brand || 'N/A',
        size: size || 'N/A',
        invoiceNumber,
        date,
        narration,
        debit: totalCost,
        credit: 0,
        createdAt: new Date(),
      });

      setCompany("");
      setBrand("");
      setModel("");
      setSize("");
      setPrice("");
      setQuantity("");
      setStore("");
      setShop("");
      setDate("");
      setConfirmModalIsOpen(false);
    } catch (err) {
      toast.error("Error processing tyre purchase.");
      console.error(err);
    }
  };

  const handleDelete = async (tyre) => {
    try {
      await deleteDoc(doc(db, "purchasedTyres", tyre.id));
      if (tyre.invoiceNumber) {
        const ledgerQuery = query(
          collection(db, "companyLedgerEntries"),
          where("invoiceNumber", "==", tyre.invoiceNumber)
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);
        ledgerSnapshot.forEach(async (ledgerDoc) => {
          await deleteDoc(doc(db, "companyLedgerEntries", ledgerDoc.id));
        });
      }
      setSelectedTyre(null);
      toast.success("Tyre and corresponding ledger entry deleted successfully!");
    } catch (err) {
      toast.error("Error deleting tyre or ledger entry.");
      console.error(err);
    }
  };

  const openEditModal = (tyre) => {
    setEditTyre({
      id: tyre.id,
      company: getOriginalCompanyName(tyre.company), // Use original name for display
      brand: tyre.brand,
      model: tyre.model,
      size: tyre.size,
      price: tyre.price,
      quantity: tyre.quantity,
      store: tyre.store,
      shop: tyre.shop,
      date: tyre.date,
      invoiceNumber: tyre.invoiceNumber,
    });
    setEditModalIsOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditTyre((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editTyre.company || !editTyre.brand || !editTyre.model || !editTyre.size || !editTyre.price || !editTyre.quantity || !editTyre.date) {
      toast.error("Please fill all fields");
      return;
    }
    if (Number(editTyre.price) <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }
    if (Number(editTyre.quantity) <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (Number(editTyre.store) + Number(editTyre.shop) !== Number(editTyre.quantity)) {
      toast.error("Store and Shop quantities must sum to the total Quantity");
      return;
    }
    if (Number(editTyre.store) < 0 || Number(editTyre.shop) < 0) {
      toast.error("Store and Shop quantities cannot be negative");
      return;
    }

    const totalCost = Number(editTyre.price) * Number(editTyre.quantity);
    const normalizedCompany = normalizeCompanyName(editTyre.company);
    const updatedTyre = {
      company: normalizedCompany,
      brand: editTyre.brand,
      model: editTyre.model,
      size: editTyre.size,
      price: Number(editTyre.price),
      quantity: Number(editTyre.quantity),
      store: Number(editTyre.store),
      shop: Number(editTyre.shop),
      totalPrice: totalCost,
      date: editTyre.date,
      invoiceNumber: editTyre.invoiceNumber,
    };

    try {
      await updateDoc(doc(db, "purchasedTyres", editTyre.id), updatedTyre);

      if (editTyre.invoiceNumber) {
        const ledgerQuery = query(
          collection(db, "companyLedgerEntries"),
          where("invoiceNumber", "==", editTyre.invoiceNumber)
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);
        if (!ledgerSnapshot.empty) {
          const ledgerDoc = ledgerSnapshot.docs[0];
          const narration = `${editTyre.size || 'N/A'}_${editTyre.brand || 'N/A'}_Qty_${editTyre.quantity}_Rate_${editTyre.price}`;
          await updateDoc(doc(db, "companyLedgerEntries", ledgerDoc.id), {
            companyName: normalizedCompany,
            brand: editTyre.brand || 'N/A',
            size: editTyre.size || 'N/A',
            invoiceNumber: editTyre.invoiceNumber,
            date: editTyre.date,
            narration,
            debit: totalCost,
            credit: 0,
            createdAt: new Date(),
          });
        }
      }

      setEditModalIsOpen(false);
      setEditTyre(null);
      toast.success("Tyre and ledger entry updated successfully!");
    } catch (err) {
      toast.error("Error updating tyre or ledger entry.");
      console.error(err);
    }
  };

  const filteredTyres = tyres.filter((t) =>
    `${getOriginalCompanyName(t.company)} ${t.brand} ${t.model} ${t.size}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTyres.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTyres.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">🛒 Buy Tyre</h2>
      <form className="grid grid-cols-3 gap-4 mb-6" onSubmit={handleSubmit}>
        <div className="relative">
          <input
            type="text"
            placeholder="Select Party"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            list="companySuggestions"
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
          />
          <datalist id="companySuggestions">
            {companies.map((companyName, idx) => (
              <option key={idx} value={companyName} />
            ))}
          </datalist>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            list="brandSuggestions"
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
          />
          <datalist id="brandSuggestions">
            {brands.map((brandOption, idx) => (
              <option key={idx} value={brandOption} />
            ))}
          </datalist>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            list="modelSuggestions"
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
          />
          <datalist id="modelSuggestions">
            {models.map((modelOption, idx) => (
              <option key={idx} value={modelOption} />
            ))}
          </datalist>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Size"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            list="sizeSuggestions"
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
          />
          <datalist id="sizeSuggestions">
            {sizes.map((sizeOption, idx) => (
              <option key={idx} value={sizeOption} />
            ))}
          </datalist>
        </div>
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="number"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="number"
          placeholder="Store Quantity"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="number"
          placeholder="Shop Quantity"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white font-semibold rounded px-6 py-2 hover:bg-blue-700 transition"
        >
          Buy Tyre
        </button>
      </form>

      {/* Confirmation Modal */}
      {confirmModalIsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-8 relative font-sans">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Confirm Purchase Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <p><span className="font-medium">Company:</span> {company}</p>
              <p><span className="font-medium">Brand:</span> {brand}</p>
              <p><span className="font-medium">Model:</span> {model}</p>
              <p><span className="font-medium">Size:</span> {size}</p>
              <p><span className="font-medium">Price:</span> Rs. {price}</p>
              <p><span className="font-medium">Quantity:</span> {quantity}</p>
              <p><span className="font-medium">Store Quantity:</span> {store}</p>
              <p><span className="font-medium">Shop Quantity:</span> {shop}</p>
              <p><span className="font-medium">Total Price:</span> Rs. {Number(price) * Number(quantity)}</p>
              <p><span className="font-medium">Date:</span> {date}</p>
            </div>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setConfirmModalIsOpen(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmPurchase}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalIsOpen && editTyre && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-8 relative font-sans">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Edit Tyre Details</h2>
            <form onSubmit={handleEditSubmit} className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium mb-1 text-gray-700">Company</label>
                <input
                  type="text"
                  name="company"
                  value={editTyre.company}
                  onChange={handleEditChange}
                  list="companySuggestions"
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <datalist id="companySuggestions">
                  {companies.map((companyName, idx) => (
                    <option key={idx} value={companyName} />
                  ))}
                </datalist>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium mb-1 text-gray-700">Brand</label>
                <input
                  type="text"
                  name="brand"
                  value={editTyre.brand}
                  onChange={handleEditChange}
                  list="brandSuggestions"
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <datalist id="brandSuggestions">
                  {brands.map((brandOption, idx) => (
                    <option key={idx} value={brandOption} />
                  ))}
                </datalist>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium mb-1 text-gray-700">Model</label>
                <input
                  type="text"
                  name="model"
                  value={editTyre.model}
                  onChange={handleEditChange}
                  list="modelSuggestions"
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <datalist id="modelSuggestions">
                  {models.map((modelOption, idx) => (
                    <option key={idx} value={modelOption} />
                  ))}
                </datalist>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium mb-1 text-gray-700">Size</label>
                <input
                  type="text"
                  name="size"
                  value={editTyre.size}
                  onChange={handleEditChange}
                  list="sizeSuggestions"
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <datalist id="sizeSuggestions">
                  {sizes.map((sizeOption, idx) => (
                    <option key={idx} value={sizeOption} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Price</label>
                <input
                  type="number"
                  name="price"
                  value={editTyre.price}
                  onChange={handleEditChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  value={editTyre.quantity}
                  onChange={handleEditChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Store Quantity</label>
                <input
                  type="number"
                  name="store"
                  value={editTyre.store}
                  onChange={handleEditChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Shop Quantity</label>
                <input
                  type="number"
                  name="shop"
                  value={editTyre.shop}
                  onChange={handleEditChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Date</label>
                <input
                  type="date"
                  name="date"
                  value={editTyre.date}
                  onChange={handleEditChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="flex justify-end gap-4 mt-4 col-span-2">
                <button
                  type="button"
                  onClick={() => setEditModalIsOpen(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex justify-between">
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
        <table className="min-w-full border-collapse text-sm text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 font-semibold">Party</th>
              <th className="py-2 px-4 font-semibold">Brand</th>
              <th className="py-2 px-4 font-semibold">Model</th>
              <th className="py-2 px-4 font-semibold">Size</th>
              <th className="py-2 px-4 font-semibold">Price</th>
              <th className="py-2 px-4 font-semibold">Quantity</th>
              <th className="py-2 px-4 font-semibold">Store</th>
              <th className="py-2 px-4 font-semibold">Shop</th>
              <th className="py-2 px-4 font-semibold">Total Price</th>
              <th className="py-2 px-4 font-semibold">Date</th>
              <th className="py-2 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((t) => (
              <tr key={t.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-2 px-4">{getOriginalCompanyName(t.company)}</td>
                <td className="py-2 px-4">{t.brand}</td>
                <td className="py-2 px-4">{t.model}</td>
                <td className="py-2 px-4">{t.size}</td>
                <td className="py-2 px-4">Rs. {t.price}</td>
                <td className="py-2 px-4">{t.quantity}</td>
                <td className="py-2 px-4">{t.store}</td>
                <td className="py-2 px-4">{t.shop}</td>
                <td className="py-2 px-4">Rs. {t.totalPrice}</td>
                <td className="py-2 px-4">{t.date}</td>
                <td className="py-2 px-4 flex gap-2">
                  <button
                    onClick={() => openEditModal(t)}
                    className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-800 border border-red-300 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
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
      {selectedTyre && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-8 relative font-sans print:bg-white print:p-0 print:shadow-none"
            id="printable"
          >
            <header className="flex justify-between items-center border-b border-gray-200 pb-4 mb-6">
              <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                <span role="img" aria-label="Invoice">🧾</span> Purchase Invoice
              </h2>
              <p className="text-sm text-gray-500 print:hidden">
                Date: <time>{selectedTyre.date}</time>
              </p>
            </header>
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-gray-700 text-sm leading-relaxed mb-8">
              <div>
                <h3 className="font-semibold text-lg mb-3 text-gray-900 border-b border-gray-300 pb-1">
                  Company Details
                </h3>
                <p>
                  <span className="font-medium text-gray-800">Company:</span>{" "}
                  {getOriginalCompanyName(selectedTyre.company)}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3 text-gray-900 border-b border-gray-300 pb-1">
                  Tyre Details
                </h3>
                <p>
                  <span className="font-medium text-gray-800">Brand:</span>{" "}
                  {selectedTyre.brand}
                </p>
                <p>
                  <span className="font-medium text-gray-800">Model:</span>{" "}
                  {selectedTyre.model}
                </p>
                <p>
                  <span className="font-medium text-gray-800">Size:</span>{" "}
                  {selectedTyre.size}
                </p>
              </div>
            </section>
            <section className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8">
              <h3 className="font-semibold text-lg mb-4 text-gray-900 border-b border-gray-300 pb-2">
                Pricing Summary
              </h3>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-gray-700 text-sm">
                <dt className="font-medium">Quantity:</dt>
                <dd>{selectedTyre.quantity}</dd>
                <dt className="font-medium">Store Quantity:</dt>
                <dd>{selectedTyre.store}</dd>
                <dt className="font-medium">Shop Quantity:</dt>
                <dd>{selectedTyre.shop}</dd>
                <dt className="font-medium">Price per Tyre:</dt>
                <dd>Rs. {selectedTyre.price}</dd>
                <dt className="font-bold text-lg">Total:</dt>
                <dd className="font-bold text-lg">Rs. {selectedTyre.totalPrice}</dd>
              </dl>
            </section>
            <footer className="flex justify-between items-center text-gray-600 text-sm print:hidden">
              <p>
                Status:{" "}
                <span className="font-semibold text-green-600">Purchased</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="bg-green-600 hover:bg-green-700 transition text-white px-5 py-2 rounded-md shadow"
                >
                  🖨️ Print
                </button>
                <button
                  onClick={() => setSelectedTyre(null)}
                  className="bg-red-600 hover:bg-red-700 transition text-white px-5 py-2 rounded-md shadow"
                >
                  ❌ Close
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyTyre;