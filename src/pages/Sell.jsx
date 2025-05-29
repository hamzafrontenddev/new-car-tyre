import React, { useEffect, useState, useRef } from "react";
import { toast } from "react-toastify";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
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

const SellTyre = () => {
  const [form, setForm] = useState({
    company: "",
    brand: "",
    model: "",
    size: "",
    price: "",
    quantity: "",
    date: new Date().toISOString().split("T")[0],
    discount: "",
    due: "",
    shopQuantity: "",
    comment: "",
  });

  const printRef = useRef();
  const [customerName, setCustomerName] = useState('');
  const [sellTyres, setSellTyres] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editingTyre, setEditingTyre] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemTyres, setItemTyres] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [viewTyre, setViewTyre] = useState(null);
  const [availableSizes, setAvailableSizes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const win = window.open("", "", "height=600,width=800");
      win.document.write("");
      win.document.write(printContents);
      win.document.write("");
      win.document.close();
      win.print();
    }
  };

  useEffect(() => {
    const unsubSell = onSnapshot(collection(db, "soldTyres"), (snapshot) => {
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort by createdAt in descending order (newest first)
      data = data.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });
      // Apply date range filter after sorting
      data = filterByDateRange(data, startDate, endDate);
      setSellTyres(data);
    });

    const fetchItemTyres = async () => {
      const snapshot = await getDocs(collection(db, "addItemTyres"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setItemTyres(data);
      setAvailableCompanies([...new Set(data.map((t) => t.company?.toLowerCase()))]);
    };

    fetchItemTyres();
    return () => unsubSell();
  }, [startDate, endDate]);

  useEffect(() => {
    if (editingTyre) {
      handleCompanyChange({ target: { value: editingTyre.company || "" } });
    }
  }, [editingTyre]);

  useEffect(() => {
    if (editingTyre && form.company) {
      handleBrandChange({ target: { value: editingTyre.brand || "" } });
    }
  }, [form.company, editingTyre]);

  useEffect(() => {
    if (editingTyre && form.brand) {
      handleModelChange({ target: { value: editingTyre.model || "" } });
    }
  }, [form.brand, editingTyre]);

  useEffect(() => {
    if (editingTyre && form.model) {
      handleSizeChange({ target: { value: editingTyre.size || "" } });
    }
  }, [form.model, editingTyre]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newForm = { ...form, [name]: value };
    setForm(newForm);

    // Recalculate totalPrice dynamically for price, quantity, discount, or due
    const price = parseFloat(newForm.price) || 0;
    const quantity = parseInt(newForm.quantity) || 0;
    const discount = parseFloat(newForm.discount) || 0;
    const due = parseFloat(newForm.due) || 0;
    const discountedPrice = price - discount;
    const totalPrice = discountedPrice * quantity - due;
    setForm((prev) => ({
      ...prev,
      totalPrice: totalPrice >= 0 ? totalPrice : 0,
    }));
  };

  const handleCompanyChange = (e) => {
    const company = e.target.value.trim();
    setForm((prev) => ({
      ...prev,
      company,
      brand: "",
      model: "",
      size: "",
      price: "",
      quantity: prev.quantity || "",
      date: prev.date || new Date().toISOString().split("T")[0],
      discount: prev.discount || "",
      due: prev.due || "",
      shopQuantity: "",
      comment: prev.comment || "",
    }));

    const brands = itemTyres
      .filter((t) => t.company?.toLowerCase() === company.toLowerCase())
      .map((t) => t.brand);

    if (brands.length === 0 && company) {
      toast.error("❌ This company is not available in AddItem");
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
      price: "",
      quantity: prev.quantity || "",
      date: prev.date || new Date().toISOString().split("T")[0],
      discount: prev.discount || "",
      due: prev.due || "",
      shopQuantity: "",
      comment: prev.comment || "",
    }));

    const models = itemTyres
      .filter(
        (t) =>
          t.company?.toLowerCase() === form.company.toLowerCase() &&
          t.brand?.toLowerCase() === brand.toLowerCase()
      )
      .map((t) => t.model);

    if (models.length === 0 && brand) {
      toast.error("❌ This brand is not available for selected company");
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
      price: "",
      quantity: prev.quantity || "",
      date: prev.date || new Date().toISOString().split("T")[0],
      discount: prev.discount || "",
      due: prev.due || "",
      shopQuantity: "",
      comment: prev.comment || "",
    }));

    const matches = itemTyres.filter(
      (t) =>
        t.company?.toLowerCase() === form.company.toLowerCase() &&
        t.brand?.toLowerCase() === form.brand.toLowerCase() &&
        t.model?.toLowerCase() === model.toLowerCase()
    );

    if (matches.length > 0) {
      const uniqueSizes = [...new Set(matches.map((t) => t.size))];
      const firstMatch = matches[0];

      setAvailableSizes(uniqueSizes);
      setForm((prev) => {
        const updatedForm = {
          ...prev,
          size: firstMatch.size || "",
          price: firstMatch.price || "",
        };

        // Fetch shopQuantity from purchasedTyres with updated form values
        const fetchShopQuantity = async () => {
          const querySize = updatedForm.size || firstMatch.size || "";
          const purchasedQuery = query(
            collection(db, "purchasedTyres"),
            where("company", "==", updatedForm.company.trim()),
            where("brand", "==", updatedForm.brand.trim()),
            where("model", "==", model.trim()),
            where("size", "==", querySize.trim())
          );
          try {
            const purchasedSnapshot = await getDocs(purchasedQuery);
            const purchasedTyres = purchasedSnapshot.docs.map((doc) => doc.data());
            const totalShopQty = purchasedTyres.reduce((acc, curr) => acc + (parseInt(curr.shop) || 0), 0);
            setForm((prevForm) => ({
              ...prevForm,
              shopQuantity: totalShopQty.toString(),
            }));
          } catch (error) {
            console.error("Error fetching shop quantity:", error);
            toast.error("Failed to fetch shop quantity");
          }
        };
        fetchShopQuantity();

        return updatedForm;
      });
    } else {
      setAvailableSizes([]);
    }
  };

  const handleSizeChange = (e) => {
    const size = e.target.value.trim();
    const match = itemTyres.find(
      (t) =>
        t.company?.toLowerCase() === form.company.toLowerCase() &&
        t.brand?.toLowerCase() === form.brand.toLowerCase() &&
        t.model?.toLowerCase() === form.model.toLowerCase() &&
        t.size === size
    );

    if (match) {
      setForm((prev) => ({
        ...prev,
        size,
        price: match.price || "",
        comment: prev.comment || "",
      }));

      // Fetch shopQuantity from purchasedTyres
      const fetchShopQuantity = async () => {
        const purchasedQuery = query(
          collection(db, "purchasedTyres"),
          where("company", "==", form.company.trim()),
          where("brand", "==", form.brand.trim()),
          where("model", "==", form.model.trim()),
          where("size", "==", size.trim())
        );
        try {
          const purchasedSnapshot = await getDocs(purchasedQuery);
          const purchasedTyres = purchasedSnapshot.docs.map((doc) => doc.data());
          const totalShopQty = purchasedTyres.reduce((acc, curr) => acc + (parseInt(curr.shop) || 0), 0);
          setForm((prev) => ({
            ...prev,
            shopQuantity: totalShopQty.toString(),
          }));
        } catch (error) {
          console.error("Error fetching shop quantity:", error);
          toast.error("Failed to fetch shop quantity");
        }
      };
      fetchShopQuantity();
    } else {
      setForm((prev) => ({ ...prev, size, shopQuantity: "", comment: prev.comment || "" }));
    }
  };

  const confirmSellTyre = async () => {
    if (!form.company || !form.brand || !form.model || !form.size || !form.price || !form.quantity) {
      toast.error("Please fill all fields");
      return;
    }

    const enteredQty = parseInt(form.quantity);
    if (enteredQty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    // Skip quantity checks during edit
    if (!editId) {
      const shopQty = parseInt(form.shopQuantity) || 0;
      if (enteredQty > shopQty) {
        toast.error(`❌ Only ${shopQty} tyres available in shop. Cannot sell more than that.`);
        return;
      }

      const matchedItems = itemTyres.filter(
        (t) =>
          t.company?.toLowerCase() === form.company.toLowerCase() &&
          t.brand?.toLowerCase() === form.brand.toLowerCase() &&
          t.model?.toLowerCase() === form.model.toLowerCase() &&
          t.size === form.size
      );

      const totalPurchasedQty = matchedItems.reduce((acc, curr) => acc + parseInt(curr.quantity || 0), 0);

      const matchedSold = sellTyres.filter(
        (t) =>
          t.company?.toLowerCase() === form.company.toLowerCase() &&
          t.brand?.toLowerCase() === form.brand.toLowerCase() &&
          t.model?.toLowerCase() === form.model.toLowerCase() &&
          t.size === form.size
      );

      const totalSoldQty = matchedSold.reduce((acc, curr) => acc + parseInt(curr.quantity || 0), 0);
      const availableQty = totalPurchasedQty - totalSoldQty;

      if (enteredQty > availableQty) {
        toast.error(`❌ Only ${availableQty} tyres available. Cannot sell more than that.`);
        return;
      }

      // Fetch purchasedTyres to update shop quantity
      const purchasedQuery = query(
        collection(db, "purchasedTyres"),
        where("company", "==", form.company.trim()),
        where("brand", "==", form.brand.trim()),
        where("model", "==", form.model.trim()),
        where("size", "==", form.size.trim())
      );
      try {
        const purchasedSnapshot = await getDocs(purchasedQuery);
        const purchasedTyres = purchasedSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Update shop quantity
        let remainingQty = enteredQty;
        for (const tyre of purchasedTyres) {
          if (remainingQty <= 0) break;
          const currentShop = parseInt(tyre.shop) || 0;
          const deductQty = Math.min(currentShop, remainingQty);
          if (deductQty > 0) {
            await updateDoc(doc(db, "purchasedTyres", tyre.id), {
              shop: currentShop - deductQty,
            });
            remainingQty -= deductQty;
          }
        }
      } catch (error) {
        console.error("Error updating shop quantity:", error);
        toast.error("Failed to update shop quantity");
        return;
      }
    }

    const originalPrice = parseFloat(form.price);
    const discount = parseFloat(form.discount) || 0;
    const due = parseFloat(form.due) || 0;
    const discountedPrice = originalPrice - discount;

    if (discountedPrice < 0) {
      toast.error("Discount cannot exceed the original price");
      return;
    }

    const totalPrice = discountedPrice * enteredQty;
    if (due > totalPrice) {
      toast.error("Due amount cannot exceed the total price");
      return;
    }

    const payableAmount = totalPrice - due;

    const newTyre = {
      ...form,
      customerName: customerName || "N/A",
      price: discountedPrice,
      quantity: enteredQty,
      status: "Sold",
      createdAt: editId ? form.createdAt || new Date() : new Date(), // Preserve createdAt on edit, set new on add
      discount,
      due,
      payableAmount,
      comment: form.comment || "",
    };

    try {
      if (editId) {
        await updateDoc(doc(db, "soldTyres", editId), {
          ...newTyre,
          due: due,
          payableAmount: payableAmount,
        });
        toast.success("Tyre updated");
        setEditId(null);
        setEditingTyre(null);
      } else {
        await addDoc(collection(db, "soldTyres"), newTyre);
        toast.success(`Tyre sold successfully, shop quantity updated by -${enteredQty}`);
      }

      setForm({
        company: "",
        brand: "",
        model: "",
        size: "",
        price: "",
        quantity: "",
        date: new Date().toISOString().split("T")[0],
        discount: "",
        due: "",
        shopQuantity: "",
        comment: "",
      });
      setCustomerName("");
      setAvailableBrands([]);
      setAvailableModels([]);
      setAvailableSizes([]);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Operation failed: " + error.message);
    }
  };

  const handleSellTyre = () => {
    // Show the confirmation popup instead of directly selling
    setShowConfirmPopup(true);
  };

  const handleConfirmSell = () => {
    setShowConfirmPopup(false);
    confirmSellTyre();
  };

  const handleCancelSell = () => {
    setShowConfirmPopup(false);
  };

  const filteredTyres = sellTyres.filter((tyre) =>
    Object.values(tyre).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTyres.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTyres.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="max-w-8xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">🛒 Sell Item</h2>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <input
          type="text"
          name="customerName"
          placeholder="Customer Name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="border border-gray-300 p-2 rounded w-full"
        />
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
          name="price"
          placeholder="Price"
          value={form.price}
          readOnly
          className="border border-gray-300 p-2 rounded w-full"
        />
        <input
          type="number"
          name="quantity"
          placeholder="Quantity"
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
          name="discount"
          placeholder="Discount"
          value={form.discount}
          onChange={handleChange}
          className="border border-gray-300 p-2 rounded w-full"
          min="0"
        />
        <input
          type="number"
          name="due"
          placeholder="Due Amount"
          value={form.due}
          onChange={handleChange}
          className="border border-gray-300 p-2 rounded w-full"
          min="0"
        />
        <input
          type="number"
          name="shopQuantity"
          placeholder="Shop Quantity"
          value={form.shopQuantity}
          readOnly
          className="border border-gray-300 p-2 rounded w-full bg-gray-100"
        />
        <input
          type="number"
          name="totalPrice"
          placeholder="Total Price"
          value={form.totalPrice || ""}
          readOnly
          className="border border-gray-300 p-2 rounded w-full bg-gray-100"
        />
        <input
          type="text"
          name="comment"
          placeholder="Add Comment"
          value={form.comment}
          onChange={handleChange}
          className="border border-gray-300 p-2 rounded w-full"
        />
      </div>

      <button
        onClick={handleSellTyre}
        className={`px-6 py-2 font-medium rounded shadow text-white ${editId ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {editId ? "Update Tyre" : "Sell Tyre"}
      </button>

      {/* Confirmation Popup */}
      {showConfirmPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Confirm Customer Information</h3>
            <div className="mb-4">
              <p className="text-gray-700">
                <span className="font-medium">Customer Name:</span> {customerName || "N/A"}
              </p>
              <p className="text-gray-700 mt-2">Is this information correct?</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelSell}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              >
                No
              </button>
              <button
                onClick={handleConfirmSell}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mt-10 flex justify-between items-center">
        <input
          type="text"
          placeholder="🔍 Search by brand, size, etc."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className=" p-3 border border-gray-300 rounded shadow-sm mb-6"
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse bg-white rounded shadow overflow-hidden">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3">Customer</th>
              <th className="p-3">Company</th>
              <th className="p-3">Brand</th>
              <th className="p-3">Model</th>
              <th className="p-3">Size</th>
              <th className="p-3">Price</th>
              <th className="p-3">Quantity</th>
              <th className="p-3">Total Price</th>
              <th className="p-3">Discount</th>
              <th className="p-3">Due</th>
              <th className="p-3">Date</th>
              <th className="p-3">Comment</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.length > 0 ? (
              currentItems.map((tyre) => (
                <tr key={tyre.id} className="hover:bg-gray-50 transition">
                  <td className="p-3">{tyre.customerName || 'N/A'}</td>
                  <td className="p-3">{tyre.company}</td>
                  <td className="p-3">{tyre.brand}</td>
                  <td className="p-3">{tyre.model}</td>
                  <td className="p-3">{tyre.size}</td>
                  <td className="p-3">Rs. {tyre.price.toFixed(2)}</td>
                  <td className="p-3">{tyre.quantity}</td>
                  <td className="p-3 text-blue-700 font-semibold">Rs. {(tyre.payableAmount || tyre.price * tyre.quantity).toLocaleString()}</td>
                  <td className="p-3">Rs. {tyre.discount || 0}</td>
                  <td className="p-3">Rs. {tyre.due || 0}</td>
                  <td className="p-3">{tyre.date}</td>
                  <td className="p-3">
                    <textarea
                      value={tyre.comment || ""}
                      readOnly
                      rows="2"
                      className="border border-gray-300 p-2 rounded w-full resize-none"
                    />
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setForm({
                          company: tyre.company || "",
                          brand: tyre.brand || "",
                          model: tyre.model || "",
                          size: tyre.size || "",
                          price: tyre.price || "",
                          quantity: tyre.quantity || "",
                          date: tyre.date || new Date().toISOString().split("T")[0],
                          discount: tyre.discount || "",
                          due: tyre.due || "",
                          shopQuantity: "",
                          comment: tyre.comment || "",
                          createdAt: tyre.createdAt || new Date(), // Preserve createdAt for editing
                        });
                        setEditId(tyre.id);
                        setCustomerName(tyre.customerName || '');
                        setEditingTyre(tyre);
                      }}
                      className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => setViewTyre(tyre)}
                      className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="13" className="text-center p-6 text-gray-500">
                  No tyres sold yet.
                </td>
              </tr>
            )}
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

      {viewTyre && (
        <div className="fixed inset-0 min-h-screen bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 print:hidden">
          <div ref={printRef} className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-8 relative font-sans print:max-w-[210mm] print:w-[210mm] print:p-6 print:shadow-none print:rounded-none print:m-0">
            <style>
              {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .invoice-container {
              width: 210mm !important;
              max-width: 210mm !important;
              padding: 20mm !important;
              margin: 0 !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: white !important;
            }
            .invoice-header {
              background: #2563eb !important; /* Fallback for gradient */
              padding: 16mm !important;
              margin-bottom: 8mm !important;
              border-radius: 8mm 8mm 0 0 !important;
              color: white !important;
            }
            .invoice-section {
              margin-bottom: 8mm !important;
            }
            .invoice-section h3 {
              font-size: 14pt !important;
              padding-bottom: 4mm !important;
              margin-bottom: 4mm !important;
              border-bottom: 1px solid #e5e7eb !important;
            }
            .invoice-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 8mm !important;
              font-size: 11pt !important;
            }
            .invoice-grid p {
              margin: 0 !important;
              line-height: 1.5 !important;
            }
            .invoice-note {
              font-size: 10pt !important;
              color: #6b7280 !important;
              text-align: center !important;
              margin-bottom: 8mm !important;
            }
            .print-hidden {
              display: none !important;
            }
          }
        `}
            </style>

            {/* Main Invoice Container */}
            <div className="invoice-container">
              {/* Header */}
              <div className="invoice-header bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-2xl flex justify-between items-center">
                <h2 className="text-3xl font-bold print:text-2xl text-center">Srhad Tyres Treaders</h2>
                <div className="text-sm print:text-xs">
                  <p className="text-center"> Date: <time>{viewTyre.date}</time></p>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="invoice-section mb-6">
                <div className="invoice-grid grid grid-cols-1 md:grid-cols-2 gap-8 text-gray-700">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Customer Details</h3>
                    <p><span className="font-medium">Customer Name:</span> {viewTyre.customerName || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Tire Details</h3>
                    <p><span className="font-medium">Brand:</span> {viewTyre.brand}</p>
                    <p><span className="font-medium">Model:</span> {viewTyre.model}</p>
                    <p><span className="font-medium">Size:</span> {viewTyre.size}</p>
                  </div>
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="invoice-section mb-6">
                <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Pricing Summary</h3>
                <div className="invoice-grid grid grid-cols-2 gap-x-6 gap-y-3 text-gray-700">
                  <p className="font-medium">Per Piece Price:</p>
                  <p>Rs. {viewTyre.price.toFixed(2)}</p>
                  <p className="font-medium">Quantity:</p>
                  <p>{viewTyre.quantity}</p>
                  <p className="font-medium">Discount:</p>
                  <p>Rs. {viewTyre.discount || 0}</p>
                  <p className="font-medium">Due Amount:</p>
                  <p>Rs. {viewTyre.due || 0}</p>
                  <p className="font-medium text-lg text-gray-800">Total Amount:</p>
                  <p className="font-medium text-lg text-gray-800">Rs. {(viewTyre.payableAmount || viewTyre.price * viewTyre.quantity).toLocaleString()}</p>
                </div>
              </div>

              {/* Note */}
              <div className="invoice-note text-center mb-6">
                <p className="text-sm text-gray-500">Note: We provide a wide range of imported tires and rims for all types of vehicles.</p>
              </div>

              {/* Buttons (Hidden on Print) */}
              <div className="print-hidden flex justify-between items-center text-gray-600 text-sm mt-6">
                <p>Status: <span className="font-semibold text-green-600">Sold</span></p>
                <div className="flex gap-3">
                  <button
                    onClick={handlePrint}
                    className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  >
                    Print Invoice
                  </button>
                  <button
                    onClick={() => setViewTyre(null)}
                    className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellTyre;