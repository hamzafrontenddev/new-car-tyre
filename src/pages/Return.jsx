import React, { useEffect, useState, useRef } from "react";
import { collection, addDoc, onSnapshot, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { v4 as uuidv4 } from "uuid";

const filterByDateRange = (data, start, end) => {
  if (!start || !end) return data;
  return data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
};

const Return = () => {
  const initialItemState = {
    customer: "",
    company: "",
    brand: "",
    model: "",
    size: "",
    price: "",
    quantity: "",
    returnQuantity: "",
    returnPrice: "",
    discount: "",
    date: new Date().toISOString().split("T")[0],
    comment: "",
  };

  const [formItems, setFormItems] = useState([initialItemState]);
  const [soldTyres, setSoldTyres] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerInputRef = useRef(null);
  const itemsPerPage = 5;
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerInputRef.current && !customerInputRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "soldTyres"), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setSoldTyres(data);
    }, (error) => {
      console.error("Error fetching soldTyres:", error);
      toast.error("Failed to load sold tyres");
    });

    const unsub2 = onSnapshot(collection(db, "returnedTyres"), (snapshot) => {
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data = filterByDateRange(data, startDate, endDate);
      setReturns(data);
    }, (error) => {
      console.error("Error fetching returnedTyres:", error);
      toast.error("Failed to load returns");
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [startDate, endDate]);

  const customers = [...new Set(soldTyres.map((t) => t.customerName).filter((c) => c && c.trim() !== ""))];

  const getFilteredOptions = (index) => {
    const company = formItems[index].company;
    const brand = formItems[index].brand;
    const model = formItems[index].model;
    const customer = formItems[0].customer;

    const companies = [
      ...new Set(
        soldTyres.filter((t) => t.customerName === customer).map((t) => t.company)
      ),
    ];
    const brands = [
      ...new Set(
        soldTyres
          .filter((t) => t.customerName === customer && t.company === company)
          .map((t) => t.brand)
      ),
    ];
    const models = [
      ...new Set(
        soldTyres
          .filter((t) => t.customerName === customer && t.company === company && t.brand === brand)
          .map((t) => t.model)
      ),
    ];
    const sizes = [
      ...new Set(
        soldTyres
          .filter((t) => t.customerName === customer && t.company === company && t.brand === brand && t.model === model)
          .map((t) => t.size)
      ),
    ];

    return { companies, brands, models, sizes };
  };

  const handleCustomerChange = (customer) => {
    setFormItems((prev) => prev.map(item => ({ ...item, customer, company: "", brand: "", model: "", size: "", price: "", quantity: "", discount: "" })));
    setShowCustomerDropdown(false);
  };

  const handleFieldChange = (index, field, value) => {
    setFormItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };

      if (field === "company") {
        newItems[index] = { ...newItems[index], brand: "", model: "", size: "", price: "", quantity: "", discount: "" };
      } else if (field === "brand") {
        newItems[index] = { ...newItems[index], model: "", size: "", price: "", quantity: "", discount: "" };
      } else if (field === "model") {
        newItems[index] = { ...newItems[index], size: "", price: "", quantity: "", discount: "" };
      }

      if (field === "size") {
        const match = soldTyres.find(
          (t) =>
            t.customerName === newItems[0].customer &&
            t.company === newItems[index].company &&
            t.brand === newItems[index].brand &&
            t.model === newItems[index].model &&
            t.size === value
        );
        if (match) {
          newItems[index] = {
            ...newItems[index],
            price: match.price || "",
            quantity: match.quantity || "",
            discount: match.discount || "",
          };
        }
      }

      return newItems;
    });
  };

  const addItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        ...initialItemState,
        customer: prev[0].customer,
        date: prev[0].date,
      },
    ]);
  };

  const removeItem = (index) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const [index, item] of formItems.entries()) {
      if (!item.customer || !item.company || !item.brand || !item.model || !item.size || !item.returnQuantity || !item.returnPrice || !item.date) {
        toast.error(`Please fill all required fields for item ${index + 1}`);
        return;
      }
      if (Number(item.returnQuantity) <= 0) {
        toast.error(`Return quantity must be greater than 0 for item ${index + 1}`);
        return;
      }
      if (Number(item.returnQuantity) > Number(item.quantity)) {
        toast.error(`Return quantity cannot exceed original sold quantity for item ${index + 1}`);
        return;
      }
    }

    const transactionId = uuidv4();

    try {
      for (const item of formItems) {
        const returnTyre = {
          customer: item.customer,
          company: item.company,
          brand: item.brand,
          model: item.model,
          size: item.size,
          price: Number(item.price),
          quantity: Number(item.quantity),
          totalPrice: Number(item.price) * Number(item.quantity),
          returnQuantity: Number(item.returnQuantity),
          returnPrice: Number(item.returnPrice),
          returnTotalPrice: Number(item.returnPrice) * Number(item.returnQuantity),
          date: item.date,
          discount: Number(item.discount || 0),
          comment: item.comment || "",
          transactionId,
        };

        await addDoc(collection(db, "returnedTyres"), returnTyre);

        const purchasedQuery = query(
          collection(db, "purchasedTyres"),
          where("company", "==", item.company),
          where("brand", "==", item.brand),
          where("model", "==", item.model),
          where("size", "==", item.size)
        );
        const purchasedSnapshot = await getDocs(purchasedQuery);
        const purchasedTyres = purchasedSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (purchasedTyres.length === 0) {
          toast.error(`No matching tyre found in purchasedTyres for item ${item.company} ${item.brand} ${item.model} (${item.size})`);
          continue;
        }

        const targetTyre = purchasedTyres[0];
        const currentShop = parseInt(targetTyre.shop) || 0;
        const newShopQuantity = currentShop + Number(item.returnQuantity);

        await updateDoc(doc(db, "purchasedTyres", targetTyre.id), {
          shop: newShopQuantity,
        });
      }

      toast.success("Tyres returned successfully!");
      setFormItems([initialItemState]);
    } catch (err) {
      console.error("Error returning tyres:", err);
      toast.error("Error returning tyres.");
    }
  };

  const filteredReturns = returns.filter((t) =>
    `${t.customer} ${t.company} ${t.brand} ${t.model} ${t.size} ${t.comment}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const groupedByTransaction = filteredReturns.reduce((acc, returnItem) => {
    const tid = returnItem.transactionId || returnItem.id;
    if (!acc[tid]) {
      acc[tid] = [];
    }
    acc[tid].push(returnItem);
    return acc;
  }, {});

  const transactions = Object.entries(groupedByTransaction).map(([tid, items]) => ({
    transactionId: tid,
    items,
    customerName: items[0]?.customer || "N/A",
    date: items[0]?.date || "",
    brands: items.map(item => item.brand).join(", "),
    models: items.map(item => item.model).join(", "),
    sizes: items.map(item => item.size).join(", "),
    quantities: items.map(item => item.quantity).join(", "),
    returnQuantities: items.map(item => item.returnQuantity).join(", "),
    prices: items.map(item => `Rs. ${item.price.toFixed(2)}`).join(", "),
    returnPrices: items.map(item => `Rs. ${item.returnPrice.toFixed(2)}`).join(", "),
    returnTotalPrices: items.reduce((sum, item) => sum + item.returnTotalPrice, 0),
    discounts: items.map(item => item.discount || 0).join(", "),
    comments: items.map(item => item.comment || "N/A").join(", "),
  }));

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-600 mb-6">🛒 Return Tyres</h1>

      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-lg font-semibold mb-4">Return Form</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              ref={customerInputRef}
              type="text"
              placeholder="Search or type customer..."
              value={formItems[0].customer}
              onChange={(e) => handleCustomerChange(e.target.value)}
              onFocus={() => setShowCustomerDropdown(true)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {showCustomerDropdown && (
              <div className="absolute bg-white border border-gray-300 rounded-lg shadow-lg mt-1 w-64 max-h-40 overflow-y-auto z-10">
                {customers
                  .filter((c) => c.toLowerCase().includes(formItems[0].customer.toLowerCase()))
                  .map((customer) => (
                    <div
                      key={customer}
                      onClick={() => handleCustomerChange(customer)}
                      className="p-2 hover:bg-blue-600 cursor-pointer text-gray-700"
                    >
                      {customer}
                    </div>
                  ))}
              </div>
            )}
          </div>
          {formItems.map((item, index) => (
            <div key={index} className="mb-6 p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Return Item #{index + 1}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <select
                    value={item.company}
                    onChange={(e) => handleFieldChange(index, "company", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Select Company</option>
                    {getFilteredOptions(index).companies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <select
                    value={item.brand}
                    onChange={(e) => handleFieldChange(index, "brand", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Select Brand</option>
                    {getFilteredOptions(index).brands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <select
                    value={item.model}
                    onChange={(e) => handleFieldChange(index, "model", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Select Model</option>
                    {getFilteredOptions(index).models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <select
                    value={item.size}
                    onChange={(e) => handleFieldChange(index, "size", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="">Select Size</option>
                    {getFilteredOptions(index).sizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input
                    type="text"
                    value={item.price}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="text"
                    value={item.quantity}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Quantity</label>
                  <input
                    type="number"
                    value={item.returnQuantity}
                    onChange={(e) => handleFieldChange(index, "returnQuantity", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Price</label>
                  <input
                    type="number"
                    value={item.returnPrice}
                    onChange={(e) => handleFieldChange(index, "returnPrice", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                  <input
                    type="text"
                    value={item.discount}
                    readOnly
                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={item.date}
                    onChange={(e) => handleFieldChange(index, "date", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                  <input
                    type="text"
                    value={item.comment}
                    onChange={(e) => handleFieldChange(index, "comment", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              {formItems.length > 1 && (
                <button
                  onClick={() => removeItem(index)}
                  className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  Remove Item
                </button>
              )}
            </div>
          ))}
          <div className="flex justify-between">
            <button
              onClick={addItem}
              className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              Add Item
            </button>
            <button
              type="submit"
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Return Tyres
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg">
        <input
          type="text"
          placeholder="Search returned items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none mb-4"
        />
        <div className="flex space-x-4 mb-6">
          <div className="relative">
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              placeholderText="Start Date"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none pl-10"
              dateFormat="yyyy-MM-dd"
              isClearable
            />
            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
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
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none pl-10"
              dateFormat="yyyy-MM-dd"
              isClearable
            />
            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Customer</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Brands</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Models</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Sizes</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Quantities</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Return Quantities</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Prices</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Return Prices</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Return Total</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Discounts</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Comments</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {currentTransactions.length > 0 ? (
                currentTransactions.map((transaction) => (
                  <tr key={transaction.transactionId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border text-gray-600">{transaction.customerName}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.brands}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.models}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.sizes}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.quantities}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.returnQuantities}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.prices}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.returnPrices}</td>
                    <td className="px-4 py-2 border text-gray-600">Rs. {transaction.returnTotalPrices.toLocaleString()}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.discounts}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.comments}</td>
                    <td className="px-4 py-2 border text-gray-600">{transaction.date}</td>
                    <td className="px-4 py-2 border">
                      <button
                        onClick={() => setSelectedReturn(transaction)}
                        className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="13" className="px-4 py-2 text-center text-gray-600">
                    No returns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-4 space-x-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
            <button
              key={number}
              onClick={() => paginate(number)}
              className={`px-3 py-1 rounded-lg ${currentPage === number ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              {number}
            </button>
          ))}
        </div>
      </div>

      {selectedReturn && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="invoice-container">
              <div className="header text-center mb-6 border-b-2 border-blue-600 pb-4">
                <h1 className="text-3xl font-bold text-blue-600">Srhad Tyres Traders</h1>
                <div className="invoice-info text-gray-600 mt-2 flex justify-between">
                  <p>Return Invoice</p>
                  <p>Date: {selectedReturn.date}</p>
                </div>
              </div>
              <div className="section mb-6">
                <h3 className="section-title text-xl font-semibold text-blue-600 mb-3">Customer Details</h3>
                <div className="customer-details grid gap-2 text-gray-700">
                  <p><strong>Name:</strong> {selectedReturn.customerName || 'N/A'}</p>
                </div>
              </div>
              <div className="section">
                <h3 className="section-title text-xl font-semibold text-blue-600 mb-3">Item Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Brand</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Model</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Size</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Original Qty</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Return Qty</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Price</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Return Price</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReturn.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.brand}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.model}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.size}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.quantity}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.returnQuantity}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">Rs. {item.price.toFixed(2)}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">Rs. {item.returnPrice.toFixed(2)}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">Rs. {item.discount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="section">
                <div className="total-section flex justify-end">
                  <div className="total-box bg-gray-50 p-4 rounded-lg w-80">
                    <p className="text-gray-700 font-bold">Total: Rs. {selectedReturn.returnTotalPrices.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="footer text-center mt-6 border-t border-gray-200 pt-4 text-gray-600">
                <p className="font-semibold">Thank you for your business!</p>
                <p>Phone: 0307-7717613 | Sher Shah Road Near Masjid Al Qadir Dera Adda, Multan, Pakistan</p>
                <p>Terms: Payment due within 30 days. All sales are final.</p>
                <p className="status font-semibold text-green-600">Status: Returned</p>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => {
                  const printContent = document.querySelector('.invoice-container').innerHTML;
                  const printWindow = window.open("", "_blank", "height=600,width=800");
                  if (!printWindow) {
                    toast.error("Please allow pop-ups for this site to enable printing.");
                    return;
                  }
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Print Return Invoice</title>
                        <style>
                          @media print {
                            @page { margin: 20mm; }
                            body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; color: #1f2937; font-size: 12pt; }
                            .invoice-container { max-width: 800px; margin: 0 auto; padding: 20px; background: #fff; }
                            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
                            .header h1 { font-size: 24pt; font-weight: 700; color: #1e40af; margin: 0; }
                            .header .invoice-info { color: #64748b; margin-top: 10px; }
                            .section { margin-bottom: 20px; }
                            .section-title { font-size: 16pt; font-weight: 600; color: #1e40af; margin-bottom: 10px; }
                            .customer-details { display: grid; grid-template-columns: 1fr; gap: 5px; }
                            .customer-details p { margin: 0; color: #374151; }
                            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
                            th { background-color: #f8fafc; font-weight: 600; color: #1f2937; }
                            td { color: #374151; }
                            .total-section { display: flex; justify-content: flex-end; }
                            .total-box { width: 300px; background: #f8fafc; padding: 10px; border-radius: 8px; }
                            .total-box p { margin: 5px 0; color: #374151; font-weight: 600; font-size: 14pt; color: #1e40af; }
                            .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 10pt; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                            .status { font-weight: 600; color: #059669; }
                            .no-page-break { page-break-inside: avoid; }
                          }
                        </style>
                      </head>
                      <body>
                        ${printContent}
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                  }, 500);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                Print Invoice
              </button>
              <button
                onClick={() => setSelectedReturn(null)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Return;