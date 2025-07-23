import React, { useEffect, useState, useRef } from "react";
import { collection, addDoc, onSnapshot, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { v4 as uuidv4 } from "uuid";
import Select from "react-select";

// Helper function to normalize dates for comparison
const normalizeDate = (date) => {
  if (!date) return null;
  if (typeof date === "string") return new Date(date);
  if (date.toDate) return date.toDate(); // Handle Firestore Timestamp
  return date;
};

// Filter data by date range
const filterByDateRange = (data, start, end) => {
  if (!start || !end) return data;
  return data.filter((item) => {
    const itemDate = normalizeDate(item.date);
    if (!itemDate) return false;
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
    date: new Date().toISOString().split("T")[0],
    comment: "",
  };

  const [formItems, setFormItems] = useState([initialItemState]);
  const [purchasedTyres, setPurchasedTyres] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const customerInputRef = useRef(null);
  const itemsPerPage = 5;
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [availableSizes, setAvailableSizes] = useState([]);

  // Handle clicks outside customer dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerInputRef.current && !customerInputRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch purchasedTyres, returnedTyres, and customers from Firestore
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Fetch purchasedTyres
    const fetchPurchasedTyres = async () => {
      try {
        const snapshot = await getDocs(collection(db, "purchasedTyres"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPurchasedTyres(data);
        setAvailableCompanies([...new Set(data.map((t) => t.company?.toLowerCase()))]);
      } catch (error) {
        console.error("Error fetching purchasedTyres:", error.message);
        setError("Failed to load purchased tyres: " + error.message);
        toast.error("Failed to load purchased tyres: " + error.message);
      }
    };

    // Fetch returnedTyres
    const unsubReturns = onSnapshot(
      collection(db, "returnedTyres"),
      (snapshot) => {
        let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        data = filterByDateRange(data, startDate, endDate);
        setReturns(data);
        console.log("Fetched returns:", data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching returnedTyres:", error.message);
        setError("Failed to load returns: " + error.message);
        toast.error("Failed to load returns: " + error.message);
        setLoading(false);
      }
    );

    // Fetch customers
    const fetchCustomers = async () => {
      try {
        const q = query(collection(db, "users"), where("userType", "==", "Customer"));
        const snapshot = await getDocs(q);
        const customerData = snapshot.docs.map((doc) => ({
          name: doc.data().name,
          address: doc.data().address || "Not provided",
          phone: doc.data().phone || "Not provided",
        }));
        setCustomers(customerData);
      } catch (error) {
        console.error("Error fetching customers:", error.message);
        setError("Failed to load customers: " + error.message);
        toast.error("Failed to load customers: " + error.message);
      }
    };

    fetchPurchasedTyres();
    fetchCustomers();

    return () => {
      unsubReturns();
    };
  }, [startDate, endDate]);

  // Handle customer search
  const handleCustomerSearch = (e) => {
    const value = e.target.value;
    setCustomerSearch(value);
    setShowCustomerDropdown(true);
    setFormItems((prev) => {
      const newItems = [...prev];
      newItems[0] = { ...newItems[0], customer: value }; // Update only the first item's customer
      return newItems;
    });
  };

  // Handle customer selection
  const handleCustomerSelect = async (customerName) => {
    setCustomerSearch(customerName);
    setFormItems((prev) =>
      prev.map((item) => ({
        ...item,
        customer: customerName,
        company: "",
        brand: "",
        model: "",
        size: "",
        price: "",
        quantity: "",
      }))
    );

    // Fetch the last sold tyre for this customer
    const soldTyresRef = collection(db, "soldTyres");
    const q = query(soldTyresRef, where("customer", "==", customerName), orderBy("date", "desc"), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const lastSale = snapshot.docs[0].data();
      setFormItems((prev) => {
        const newItems = [...prev];
        newItems[0] = {
          ...newItems[0],
          company: lastSale.company || "",
          brand: lastSale.brand || "",
          model: lastSale.model || "",
          size: lastSale.size || "",
          price: lastSale.price || "",
          quantity: lastSale.quantity || "",
        };
        return newItems;
      });
    }

    setShowCustomerDropdown(false);
    console.log("Selected customer:", customerName);
  };

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Get filtered options for dropdowns
  const getFilteredOptions = (index) => {
    const company = formItems[index].company;
    const brand = formItems[index].brand;
    const model = formItems[index].model;

    const companies = [...new Set(purchasedTyres
      .map((t) => t.company)
      .filter((c) => c && typeof c === "string" && c.trim() !== ""))];

    const brands = [...new Set(purchasedTyres
      .filter((t) => t.company === company)
      .map((t) => t.brand)
      .filter((b) => b && typeof b === "string" && b.trim() !== ""))];

    const models = [...new Set(purchasedTyres
      .filter((t) => t.company === company && t.brand === brand)
      .map((t) => t.model)
      .filter((m) => m && typeof m === "string" && m.trim() !== ""))];

    const sizes = [...new Set(purchasedTyres
      .filter((t) => t.company === company && t.brand === brand && t.model === model)
      .map((t) => t.size)
      .filter((s) => s && typeof s === "string" && s.trim() !== ""))];

    console.log("Filtered options for index", index, { companies, brands, models, sizes });

    return { companies, brands, models, sizes };
  };

  // Handle company change
  const handleCompanyChange = (e, index) => {
    const company = e.target.value;
    setFormItems((prev) => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        company,
        brand: "",
        model: "",
        size: "",
        price: "",
        quantity: "",
      };
      return newItems;
    });

    const brands = purchasedTyres
      .filter((t) => t.company?.toLowerCase() === company.toLowerCase())
      .map((t) => t.brand);

    if (brands.length === 0 && company) {
      toast.error("❌ This company is not available in purchased tyres");
      setAvailableBrands([]);
      setAvailableModels([]);
      setAvailableSizes([]);
      return;
    }

    setAvailableBrands([...new Set(brands)]);
    setAvailableModels([]);
    setAvailableSizes([]);
  };

  // Handle brand change
  const handleBrandChange = (e, index) => {
    const brand = e.target.value;
    setFormItems((prev) => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        brand,
        model: "",
        size: "",
        price: "",
        quantity: "",
      };
      return newItems;
    });

    const models = purchasedTyres
      .filter(
        (t) =>
          t.company?.toLowerCase() === formItems[index].company.toLowerCase() &&
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

  // Handle model change
  const handleModelChange = (e, index) => {
    const model = e.target.value;
    setFormItems((prev) => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        model,
        size: "",
        price: "",
        quantity: "",
      };
      return newItems;
    });

    const matches = purchasedTyres.filter(
      (t) =>
        t.company?.toLowerCase() === formItems[index].company.toLowerCase() &&
        t.brand?.toLowerCase() === formItems[index].brand.toLowerCase() &&
        t.model?.toLowerCase() === model.toLowerCase()
    );

    if (matches.length > 0) {
      const uniqueSizes = [...new Set(matches.map((t) => t.size))];
      const firstMatch = matches[0];

      setAvailableSizes(uniqueSizes);
      setFormItems((prev) => {
        const newItems = [...prev];
        newItems[index] = {
          ...newItems[index],
          size: firstMatch.size || "",
          price: firstMatch.price || "",
          quantity: firstMatch.shop || "",
        };
        return newItems;
      });
    } else {
      setAvailableSizes([]);
    }
  };

  // Handle size change
  const handleSizeChange = (e, index) => {
    const size = e.target.value;
    const match = purchasedTyres.find(
      (t) =>
        t.company?.toLowerCase() === formItems[index].company.toLowerCase() &&
        t.brand?.toLowerCase() === formItems[index].brand.toLowerCase() &&
        t.model?.toLowerCase() === formItems[index].model.toLowerCase() &&
        t.size === size
    );

    if (match) {
      setFormItems((prev) => {
        const newItems = [...prev];
        newItems[index] = {
          ...newItems[index],
          size,
          price: match.price || "",
          quantity: match.shop || "",
        };
        return newItems;
      });
    } else {
      setFormItems((prev) => {
        const newItems = [...prev];
        newItems[index] = {
          ...newItems[index],
          size,
          price: "",
          quantity: "",
        };
        return newItems;
      });
    }
  };

  // Handle form field changes
  const handleFieldChange = (index, field, value) => {
    setFormItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  // Add new item to form
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

  // Remove item from form
  const removeItem = (index) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.info("Processing return..."); // Show toast when button is clicked

    for (const [index, item] of formItems.entries()) {
      if (
        !item.customer ||
        !item.company ||
        !item.brand ||
        !item.model ||
        !item.size ||
        !item.returnQuantity ||
        !item.returnPrice ||
        !item.date
      ) {
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
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 0,
          totalPrice: Number(item.price) * Number(item.quantity),
          returnQuantity: Number(item.returnQuantity) || 0,
          returnPrice: Number(item.returnPrice) || 0,
          returnTotalPrice: Number(item.returnPrice) * Number(item.returnQuantity),
          date: item.date,
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
        if (purchasedSnapshot.empty) {
          toast.error(`No matching tyre found in purchasedTyres for ${item.company} ${item.brand} ${item.model} (${item.size})`);
          continue;
        }

        const targetTyre = purchasedSnapshot.docs[0];
        const currentShop = parseInt(targetTyre.data().shop) || 0;
        const newShopQuantity = currentShop + Number(item.returnQuantity);

        await updateDoc(doc(db, "purchasedTyres", targetTyre.id), {
          shop: newShopQuantity,
        });
      }

      toast.success("Tyres returned successfully!");
      setFormItems([initialItemState]);
      setCustomerSearch("");
    } catch (err) {
      console.error("Error returning tyres:", err);
      toast.error("Error returning tyres: " + err.message);
    }
  };

  // Filter returns based on search
  const filteredReturns = returns.filter((t) =>
    `${t.customer} ${t.company} ${t.brand} ${t.model} ${t.size} ${t.comment}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // Group returns by transaction ID
  const groupedByTransaction = filteredReturns.reduce((acc, returnItem) => {
    const tid = returnItem.transactionId || returnItem.id;
    if (!acc[tid]) {
      acc[tid] = [];
    }
    acc[tid].push(returnItem);
    return acc;
  }, {});

  // Prepare transactions for display
  const transactions = Object.entries(groupedByTransaction).map(([tid, items]) => ({
    transactionId: tid,
    items,
    customerName: items[0]?.customer || "N/A",
    date: items[0]?.date || "",
    brands: items.map((item) => item.brand).join(", "),
    models: items.map((item) => item.model).join(", "),
    sizes: items.map((item) => item.size).join(", "),
    quantities: items.map((item) => item.quantity).join(", "),
    returnQuantities: items.map((item) => item.returnQuantity).join(", "),
    prices: items.map((item) => `Rs. ${Number(item.price).toFixed(2)}`).join(", "),
    returnPrices: items.map((item) => `Rs. ${Number(item.returnPrice).toFixed(2)}`).join(", "),
    returnTotalPrices: items.reduce((sum, item) => sum + Number(item.returnTotalPrice), 0),
    comments: items.map((item) => item.comment || "N/A").join(", "),
  }));

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-600 mb-6">🛒 Return Tyres</h1>

      {loading && <p className="text-gray-600">Loading data...</p>}
      {error && <p className="text-red-600 font-semibold">{error}</p>}

      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-lg font-semibold mb-4">Return Form</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              ref={customerInputRef}
              type="text"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={handleCustomerSearch}
              onFocus={() => setShowCustomerDropdown(true)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {showCustomerDropdown && (
              <div className="absolute bg-white border border-gray-300 rounded-lg shadow-lg mt-1 w-64 max-h-40 overflow-y-auto z-10">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <div
                      key={customer.name}
                      onMouseDown={() => handleCustomerSelect(customer.name)}
                      className="p-2 hover:bg-blue-600 hover:text-white cursor-pointer text-gray-700"
                    >
                      {customer.name}
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-gray-700">No customers found</div>
                )}
              </div>
            )}
          </div>
          {formItems.map((item, index) => (
            <div key={index} className="mb-6 p-4 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Return Item #{index + 1}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Party</label>
                  <Select
                    options={availableCompanies.map(c => ({ label: c, value: c }))}
                    value={item.company ? { label: item.company, value: item.company } : null}
                    onChange={option => handleCompanyChange({ target: { value: option ? option.value : "" } }, index)}
                    placeholder="Select Party"
                    isClearable
                    classNamePrefix="react-select"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <Select
                    options={availableBrands.map(b => ({ label: b, value: b }))}
                    value={item.brand ? { label: item.brand, value: item.brand } : null}
                    onChange={option => handleBrandChange({ target: { value: option ? option.value : "" } }, index)}
                    placeholder="Select Brand"
                    isClearable
                    classNamePrefix="react-select"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <Select
                    options={availableModels.map(m => ({ label: m, value: m }))}
                    value={item.model ? { label: item.model, value: item.model } : null}
                    onChange={option => handleModelChange({ target: { value: option ? option.value : "" } }, index)}
                    placeholder="Select Model"
                    isClearable
                    classNamePrefix="react-select"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <Select
                    options={availableSizes.map(s => ({ label: s, value: s }))}
                    value={item.size ? { label: item.size, value: item.size } : null}
                    onChange={option => handleSizeChange({ target: { value: option ? option.value : "" } }, index)}
                    placeholder="Select Size"
                    isClearable
                    classNamePrefix="react-select"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Original Price</label>
                  <input
                    type="text"
                    onChange={e => handleFieldChange(index, "price", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Original Quantity</label>
                  <input
                    type="text"
                    onChange={e => handleFieldChange(index, "quantity", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Quantity</label>
                  <input
                    type="number"
                    value={item.returnQuantity}
                    onChange={e => handleFieldChange(index, "returnQuantity", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Price</label>
                  <input
                    type="number"
                    value={item.returnPrice}
                    onChange={e => handleFieldChange(index, "returnPrice", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={item.date}
                    onChange={e => handleFieldChange(index, "date", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                  <input
                    type="text"
                    value={item.comment}
                    onChange={e => handleFieldChange(index, "comment", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              {formItems.length > 1 && (
                <button
                  type="button"
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
              type="button"
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
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Comments</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {currentTransactions.length > 0 ? (
                currentTransactions.map((transaction) => (
                  <tr key={transaction.transactionId} className="hover:bg-gray-50">
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.customerName}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.brands}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.models}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.sizes}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.quantities}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.returnQuantities}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.prices}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.returnPrices}</td>
                    <td className="px-2 py-2 border-b text-gray-600">Rs. {transaction.returnTotalPrices.toLocaleString()}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{transaction.comments}</td>
                    <td className="px-2 py-2 border-b text-gray-600">{normalizeDate(transaction.date)?.toLocaleDateString() || 'N/A'}</td>
                    <td className="px-2 py-2 border-b">
                      <button
                        onClick={() => setSelectedReturn(transaction)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="12" className="px-4 py-2 text-center border-b text-gray-600">
                    No returns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center space-x-4 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => paginate(page)}
              className={`px-3 py-1 rounded-lg ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-500 hover:text-white transition`}
            >
              {page}
            </button>
          ))}
        </div>
      </div>

      {selectedReturn && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white p-8 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-x-auto">
            <div className="invoice-container">
              <div className="header text-center mb-6 border-b-2 border-blue-600 pb-4">
                <h1 className="text-3xl font-bold text-blue-600">Srhad Tyres Traders</h1>
                <div className="invoice-details text-gray-600 mt-2 flex items-center justify-between">
                  <p>Return</p>
                  <p>Date: {normalizeDate(selectedReturn.date)?.toLocaleDateString() || 'N/A'}</p>
                </div>
              </div>
              <div className="section mb-6">
                <h3 className="section-header text-xl font-semibold text-blue-600 mb-3">Customer Details</h3>
                <div className="customer-details grid gap-2 text-gray-700">
                  <p>
                    <strong>Name:</strong> {selectedReturn.customerName || "N/A"}
                  </p>
                  <p>
                    <strong>Address:</strong> {customers.find(c => c.name === selectedReturn.customerName)?.address || "N/A"}
                  </p>
                </div>
              </div>
              <div className="items">
                <h3 className="section-title text-xl font-semibold text-blue-600 mb-3">Item Details</h3>
                <table className="table w-full border-b">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-4 py-2 text-left font-semibold">Brand</th>
                      <th className="border px-4 text-left font-semibold">Model</th>
                      <th className="border px-4 text-left font-semibold">Size</th>
                      <th className="border px-4 py-2 text-left font-semibold">Original Quantity</th>
                      <th className="border px-4 py-2 text-left font-semibold">Return Quantity</th>
                      <th className="border px-4 py-2 text-left font-semibold">Price</th>
                      <th className="border px-4 py-2 text-left font-semibold">Return Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReturn.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border px-4 py-2 text-gray-600">{item.brand}</td>
                        <td className="border px-4 py-2 text-gray-600">{item.model}</td>
                        <td className="border px-4 py-2 text-gray-600">{item.size}</td>
                        <td className="border px-4 py-2 text-gray-600">{item.quantity}</td>
                        <td className="border px-4 py-2 text-gray-600">{item.returnQuantity}</td>
                        <td className="border px-4 py-2 text-gray-600">Rs. {Number(item.price).toFixed(2)}</td>
                        <td className="border px-4 py-2 text-gray-600">Rs. {Number(item.returnPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="section">
                <div className="total-section flex justify-end">
                  <div className="total-box bg-blue-50 p-4 rounded-lg w-80">
                    <p className="font-bold text-blue-700">
                      Total: Rs. {selectedReturn.returnTotalPrices.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="footer text-center mt-6 border-t border-gray-200 pt-4 text-gray-600">
                <p className="font-semibold">Thank you for your business!</p>
                <p>Phone: 0307-7717613 | Address: Sher Shah Road, Lahore, Pakistan</p>
                <p className="status font-semibold text-green-600">Status: Paid</p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  const printContent = document.querySelector(".invoice-container").outerHTML;
                  const printWindow = window.open("", "_blank");
                  if (!printWindow) {
                    toast.error("Error: Unable to open print window. Please check popup blocker.");
                    return;
                  }
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Print Invoice</title>
                        <style>
                          @media print {
                            @page { margin: 0; }
                            body { font-family: 'Arial', sans-serif; margin: 20px; }
                            .invoice-container { max-width: 1000px; margin: auto; padding: 20px; background: #fff; }
                            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid blue; padding-bottom: 8px; }
                            .header h1 { font-size: 24pt; font-weight: bold; color: blue; margin: 0; }
                            .invoice-details { color: grey; margin-top: 10px; display: flex; justify-content: space-between; }
                            .section { margin-bottom: 20px; }
                            .section-header { font-size: 16pt; font-weight: 600; color: blue; margin-bottom: 10px; }
                            .customer-details { display: grid; grid-template-columns: 1fr; gap: 5px; }
                            .customer-details p { margin: 0; color: grey; }
                            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                            th, td { border: 1px solid grey; padding: 8px; text-align: left; }
                            th { background-color: #f5f5f5; font-weight: bold; color: grey; }
                            td { color: grey; }
                            .total-section { display: flex; justify-content: flex-end; }
                            .total-box { background: #f0f8ff; padding: 10px; border-radius: 10px; width: 300px; }
                            .total-box p { margin: 0; font-weight: bold; font-size: 18px; color: blue; }
                            .footer { text-align: center; margin-top: 20px; color: grey; font-size: 12px; border-top: 1px solid grey; padding-top: 10px; }
                            .status { font-weight: bold; color: green; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="invoice-container">
                          ${printContent}
                        </div>
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
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Print Invoice
              </button>
              <button
                onClick={() => setSelectedReturn(null)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 ml-2"
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