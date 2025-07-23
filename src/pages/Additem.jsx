import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
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

const AddItem = () => {
  const [form, setForm] = useState({
    company: "",
    brand: "",
    model: "",
    size: "",
    price: "",
    quantity: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [localTyres, setLocalTyres] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [purchasedTyres, setPurchasedTyres] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const itemsPerPage = 5;

  useEffect(() => {
    const fetchLocalTyres = async () => {
      try {
        const snapshot = await getDocs(collection(db, "addItemTyres"));
        let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        data = filterByDateRange(data, startDate, endDate);
        // Sort by date in descending order (latest first)
        data.sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        });
        setLocalTyres(data);
      } catch (error) {
        console.error("Error fetching local tyres:", error);
        toast.error("Failed to load items");
      }
    };

    const fetchPurchasedTyres = async () => {
      try {
        const snapshot = await getDocs(collection(db, "purchasedTyres"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPurchasedTyres(data);
      } catch (error) {
        console.error("Error fetching purchased tyres:", error);
      }
    };

    fetchLocalTyres();
    fetchPurchasedTyres();
  }, [startDate, endDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "company") {
      setForm({
        company: value,
        brand: "",
        model: "",
        size: "",
        price: "",
        quantity: "",
        date: new Date().toISOString().split("T")[0],
      });
      return;
    }

    if (name === "brand") {
      setForm({
        ...form,
        brand: value,
        model: "",
        size: "",
        price: "",
        quantity: "",
      });
      return;
    }

    if (name === "model") {
      setForm({
        ...form,
        model: value,
        size: "",
        price: "",
        quantity: "",
      });
      return;
    }

    const updatedForm = { ...form, [name]: value };

    if (name === "size") {
      const matched = purchasedTyres.find(
        (t) =>
          t.company?.toLowerCase() === form.company?.toLowerCase() &&
          t.brand?.toLowerCase() === form.brand?.toLowerCase() &&
          t.model?.toLowerCase() === form.model?.toLowerCase() &&
          t.size?.toLowerCase() === value.toLowerCase()
      );
      if (matched) {
        updatedForm.price = matched.price?.toString() || "";
        updatedForm.quantity = matched.quantity?.toString() || "";
      } else {
        updatedForm.price = "";
        updatedForm.quantity = "";
      }
    }

    setForm(updatedForm);
  };

  const getCompanyOptions = () =>
    [...new Set(purchasedTyres.map((t) => t.company))].filter(Boolean);

  const getBrandOptions = () => {
    const uniqueBrands = new Set();
    return purchasedTyres
      .filter((t) => t.company?.toLowerCase() === form.company?.toLowerCase())
      .map((t) => t.brand)
      .filter((brand) => {
        if (brand && !uniqueBrands.has(brand)) {
          uniqueBrands.add(brand);
          return true;
        }
        return false;
      });
  };

  const getModelOptions = () => {
    const uniqueModels = new Set();
    return purchasedTyres
      .filter(
        (t) =>
          t.company?.toLowerCase() === form.company?.toLowerCase() &&
          t.brand?.toLowerCase() === form.brand?.toLowerCase()
      )
      .map((t) => t.model)
      .filter((model) => {
        if (model && !uniqueModels.has(model)) {
          uniqueModels.add(model);
          return true;
        }
        return false;
      });
  };

  const getSizeOptions = () => {
    return [
      ...new Set(
        purchasedTyres
          .filter(
            (t) =>
              t.company?.toLowerCase() === form.company?.toLowerCase() &&
              t.brand?.toLowerCase() === form.brand?.toLowerCase() &&
              t.model?.toLowerCase() === form.model?.toLowerCase()
          )
          .map((t) => t.size)
      ),
    ].filter(Boolean);
  };

  const handleSubmit = async () => {
    const brandExists = purchasedTyres.some(
      (t) => t.brand?.toLowerCase() === form.brand?.toLowerCase()
    );

    if (!brandExists) {
      toast.error("Brand not available in purchased tyres!");
      return;
    }

    if (!form.brand || !form.model || !form.size || !form.price || !form.quantity) {
      toast.error("Please fill all fields");
      return;
    }

    const duplicate = localTyres.find(
      (t) =>
        t.brand?.toLowerCase() === form.brand?.toLowerCase() &&
        t.model?.toLowerCase() === form.model?.toLowerCase() &&
        t.size === form.size &&
        t.price === parseFloat(form.price) &&
        t.quantity === parseInt(form.quantity) &&
        t.date === form.date
    );

    if (!selectedId && duplicate) {
      toast.error("Same tyre with identical values already exists!");
      return;
    }

    try {
      if (selectedId) {
        await updateDoc(doc(db, "addItemTyres", selectedId), {
          ...form,
          price: parseFloat(form.price),
          quantity: parseInt(form.quantity),
        });
        toast.success("Item updated");
        setSelectedId(null);
      } else {
        await addDoc(collection(db, "addItemTyres"), {
          ...form,
          price: parseFloat(form.price),
          quantity: parseInt(form.quantity),
          createdAt: new Date(),
        });
        toast.success("Item added");
      }

      setForm({
        company: "",
        brand: "",
        model: "",
        size: "",
        price: "",
        quantity: "",
        date: new Date().toISOString().split("T")[0],
      });

      const snapshot = await getDocs(collection(db, "addItemTyres"));
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data = filterByDateRange(data, startDate, endDate);
      // Sort by date in descending order (latest first)
      data.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      setLocalTyres(data);
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit item");
    }
  };

  const handleEdit = (tyre) => {
    setForm({
      brand: tyre.brand,
      model: tyre.model,
      size: tyre.size,
      price: tyre.price,
      quantity: tyre.quantity,
      date: tyre.date || new Date().toISOString().split("T")[0],
    });
    setSelectedId(tyre.id);
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "addItemTyres", id));
      toast.success("Item deleted");

      const snapshot = await getDocs(collection(db, "addItemTyres"));
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data = filterByDateRange(data, startDate, endDate);
      // Sort by date in descending order (latest first)
      data.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      setLocalTyres(data);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete item");
    }
  };

  const filteredTyres = localTyres.filter((tyre) => {
    const search = searchTerm.toLowerCase();
    return (
      tyre.brand?.toLowerCase().includes(search) ||
      tyre.model?.toLowerCase().includes(search) ||
      tyre.size?.toLowerCase().includes(search) ||
      tyre.date?.toLowerCase().includes(search) ||
      tyre.quantity?.toString().includes(search) ||
      tyre.price?.toString().includes(search)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTyres.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTyres.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">
        {selectedId ? "Edit Product" : "Item Register"}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <input
            list="company-list"
            name="company"
            placeholder="Party"
            value={form.company}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full"
          />
          <datalist id="company-list">
            {getCompanyOptions().map((c, i) => (
              <option key={i} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <input
            list="brand-list"
            name="brand"
            placeholder="Brand"
            value={form.brand}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full"
          />
          <datalist id="brand-list">
            {getBrandOptions().map((b, i) => (
              <option key={i} value={b} />
            ))}
          </datalist>
        </div>

        <div>
          <input
            list="model-list"
            name="model"
            placeholder="Model"
            value={form.model}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full"
          />
          <datalist id="model-list">
            {getModelOptions().map((m, i) => (
              <option key={i} value={m} />
            ))}
          </datalist>
        </div>

        <div>
          <input
            list="size-list"
            name="size"
            placeholder="Size"
            value={form.size}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full"
          />
          <datalist id="size-list">
            {getSizeOptions().map((s, i) => (
              <option key={i} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <input
            type="number"
            name="price"
            placeholder="Price"
            value={form.price}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full"
          />
        </div>

        <div>
          <input
            name="quantity"
            placeholder="Quantity"
            value={form.quantity}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full"
          />
        </div>

        <div>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className={`text-white px-6 py-2 rounded shadow ${selectedId ? "bg-yellow-600 hover:bg-yellow-700" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {selectedId ? "Update Tyre" : "Add Tyre"}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by brand, model, size, price, quantity, date..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded p-2 mt-5"
        />
        <div className="flex gap-2 mt-4">
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

      <h3 className="text-xl font-semibold mt-8 mb-4">Tyres List</h3>
      {currentItems.length === 0 ? (
        <p>No items found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="py-2 px-4 border">Party</th>
                <th className="py-2 px-4 border">Brand</th>
                <th className="py-2 px-4 border">Model</th>
                <th className="py-2 px-4 border">Size</th>
                <th className="py-2 px-4 border">Price</th>
                <th className="py-2 px-4 border">Quantity</th>
                <th className="py-2 px-4 border">Date</th>
                <th className="py-2 px-4 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((tyre) => (
                <tr key={tyre.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border">{tyre.company}</td>
                  <td className="py-2 px-4 border">{tyre.brand}</td>
                  <td className="py-2 px-4 border">{tyre.model}</td>
                  <td className="py-2 px-4 border">{tyre.size}</td>
                  <td className="py-2 px-4 border">Rs. {tyre.price}</td>
                  <td className="py-2 px-4 border">{tyre.quantity}</td>
                  <td className="py-2 px-4 border">{tyre.date}</td>
                  <td className="py-2 px-4 border flex gap-2">
                    <button
                      onClick={() => handleEdit(tyre)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tyre.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
              <button
                key={number}
                onClick={() => paginate(number)}
                className={`px-3 py-1 rounded ${currentPage === number ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                {number}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddItem;