import React, { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
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
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedTyre, setSelectedTyre] = useState(null);
  const itemsPerPage = 5;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "purchasedTyres"), (snapshot) => {
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data = filterByDateRange(data, startDate, endDate);
      // Sort by date in descending order (latest first)
      data.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      setTyres(data);
    });
    return () => unsub();
  }, [startDate, endDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company || !brand || !model || !size || !price || !quantity || !date) {
      toast.error("Please fill all fields");
      return;
    }
    if (Number(quantity) <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (Number(store) + Number(shop) !== Number(quantity)) {
      toast.error("Store and Shop quantities must sum to the total Quantity");
      return;
    }
    if (Number(store) < 0 || Number(shop) < 0) {
      toast.error("Store and Shop quantities cannot be negative");
      return;
    }
    const tyre = {
      company,
      brand,
      model,
      size,
      price: Number(price),
      quantity: Number(quantity),
      store: Number(store),
      shop: Number(shop),
      totalPrice: Number(price) * Number(quantity),
      date,
    };
    try {
      if (editId) {
        const tyreRef = doc(db, "purchasedTyres", editId);
        await updateDoc(tyreRef, tyre);
        toast.success("Tyre updated successfully!");
        setEditId(null);
      } else {
        await addDoc(collection(db, "purchasedTyres"), tyre);
        toast.success("Tyre purchased successfully!");
      }
      setCompany("");
      setBrand("");
      setModel("");
      setSize("");
      setPrice("");
      setQuantity("");
      setStore("");
      setShop("");
      setDate("");
    } catch (err) {
      toast.error("Error purchasing tyre.");
      console.error(err);
    }
  };

  const handleEdit = (tyre) => {
    setCompany(tyre.company);
    setBrand(tyre.brand);
    setModel(tyre.model);
    setSize(tyre.size);
    setPrice(tyre.price);
    setQuantity(tyre.quantity);
    setStore(tyre.store);
    setShop(tyre.shop);
    setDate(tyre.date);
    setEditId(tyre.id);
  };

  const handleDelete = async (tyre) => {
    try {
      await deleteDoc(doc(db, "purchasedTyres", tyre.id));
      setSelectedTyre(null);
      toast.success("Tyre deleted successfully!");
    } catch (err) {
      toast.error("Error deleting tyre.");
      console.error(err);
    }
  };

  const filteredTyres = tyres.filter((t) =>
    `${t.company} ${t.brand} ${t.model} ${t.size}`
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
        <input
          type="text"
          placeholder="Party"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          placeholder="Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          placeholder="Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          placeholder="Size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
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
          {editId ? "Update Tyre" : "Buy Tyre"}
        </button>
      </form>
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
              <th className="py-2 px-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((t) => (
              <tr key={t.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-2 px-4">{t.company}</td>
                <td className="py-2 px-4">{t.brand}</td>
                <td className="py-2 px-4">{t.model}</td>
                <td className="py-2 px-4">{t.size}</td>
                <td className="py-2 px-4">Rs. {t.price}</td>
                <td className="py-2 px-4">{t.quantity}</td>
                <td className="py-2 px-4">{t.store}</td>
                <td className="py-2 px-4">{t.shop}</td>
                <td className="py-2 px-4">Rs. {t.totalPrice}</td>
                <td className="py-2 px-4">{t.date}</td>
                <td className="py-2 px-4">
                  <button
                    onClick={() => handleEdit(t)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-800 border border-blue-300 rounded hover:bg-blue-200 mr-2"
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
                  {selectedTyre.company}
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