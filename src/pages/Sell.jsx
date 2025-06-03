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
import { v4 as uuidv4 } from "uuid";

const filterByDateRange = (data, start, end) => {
  if (!start || !end) return data;
  return data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
};

const SellTyre = () => {
  const initialItemState = {
    company: "",
    brand: "",
    model: "",
    size: "",
    price: "",
    quantity: "",
    discount: "",
    shopQuantity: "",
    comment: "",
    customerName: "",
    date: new Date().toISOString().split("T")[0],
    totalPrice: 0,
  };

  const [formItems, setFormItems] = useState([initialItemState]);
  const [transactionId, setTransactionId] = useState(null);
  const printRef = useRef();
  const [sellTyres, setSellTyres] = useState([]);
  const [editTransactionId, setEditTransactionId] = useState(null);
  const [editingTyres, setEditingTyres] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemTyres, setItemTyres] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [viewTransaction, setViewTransaction] = useState(null);
  const [availableSizes, setAvailableSizes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const customerDropdownRef = useRef(null);
  const itemsPerPage = 5;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrint = () => {
    if (printRef.current) {
      const printContents = printRef.current.innerHTML;
      const printWindow = window.open("", "_blank", "height=600,width=800");
      if (!printWindow) {
        toast.error("Please allow pop-ups for this site to enable printing.");
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Invoice</title>
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
            ${printContents}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubSell = onSnapshot(collection(db, "soldTyres"), (snapshot) => {
      try {
        let data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(0),
        }));
        data = data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });
        data = filterByDateRange(data, startDate, endDate);
        setSellTyres(data);
        setLoading(false);
      } catch (error) {
        console.error("Error in onSnapshot:", error);
        toast.error("Failed to load sold tyres data");
        setLoading(false);
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      toast.error("Error listening to sold tyres: " + error.message);
      setLoading(false);
    });

    const fetchItemTyres = async () => {
      try {
        const snapshot = await getDocs(collection(db, "addItemTyres"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setItemTyres(data);
        setAvailableCompanies([...new Set(data.map((t) => t.company?.toLowerCase()))]);
      } catch (error) {
        console.error("Error fetching item tyres:", error);
        toast.error("Failed to load item tyres");
      }
    };

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
        console.error("Error fetching customers:", error);
        toast.error("Failed to load customers");
      }
    };

    fetchItemTyres();
    fetchCustomers();
    return () => unsubSell();
  }, [startDate, endDate]);

  useEffect(() => {
    if (editingTyres) {
      setFormItems(editingTyres.map(item => ({
        ...item,
        totalPrice: ((parseFloat(item.price) || 0) - (parseFloat(item.discount) || 0)) * (parseInt(item.quantity) || 0),
      })));
      setCustomerSearch(editingTyres[0]?.customerName || "");
      editingTyres.forEach((tyre, index) => {
        handleCompanyChange({ target: { value: tyre.company || "" } }, index);
        setFormItems(prev => {
          const newItems = [...prev];
          newItems[index] = {
            ...newItems[index],
            brand: tyre.brand || "",
            model: tyre.model || "",
            size: tyre.size || "",
            price: tyre.price || "",
            quantity: tyre.quantity || "",
            discount: tyre.discount || "",
            date: tyre.date || new Date().toISOString().split("T")[0],
          };
          return newItems;
        });
      });
    }
  }, [editingTyres]);

  const handleChange = (e, index) => {
    const { name, value } = e.target;
    setFormItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [name]: value };
      const price = parseFloat(newItems[index].price) || 0;
      const quantity = parseInt(newItems[index].quantity) || 0;
      const discount = parseFloat(newItems[index].discount) || 0;
      const discountedPrice = price - discount;
      newItems[index].totalPrice = discountedPrice >= 0 ? discountedPrice * quantity : 0;
      return newItems;
    });
  };

  const handleCustomerSelect = (customer) => {
    setFormItems((prev) => prev.map(item => ({ ...item, customerName: customer })));
    setCustomerSearch(customer);
    setIsCustomerDropdownOpen(false);
  };

  const handleCustomerSearch = (e) => {
    setCustomerSearch(e.target.value);
    setIsCustomerDropdownOpen(true);
    if (!e.target.value) {
      setFormItems((prev) => prev.map(item => ({ ...item, customerName: "" })));
    }
  };

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

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
        quantity: newItems[index].quantity || "",
        discount: newItems[index].discount || "",
        shopQuantity: "",
        comment: newItems[index].comment || "",
        totalPrice: 0,
      };
      return newItems;
    });

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
        quantity: newItems[index].quantity || "",
        discount: newItems[index].discount || "",
        shopQuantity: "",
        comment: newItems[index].comment || "",
        totalPrice: 0,
      };
      return newItems;
    });

    const models = itemTyres
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

  const handleModelChange = (e, index) => {
    const model = e.target.value;
    setFormItems((prev) => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        model,
        size: "",
        price: "",
        quantity: newItems[index].quantity || "",
        discount: newItems[index].discount || "",
        shopQuantity: "",
        comment: newItems[index].comment || "",
        totalPrice: 0,
      };
      return newItems;
    });

    const matches = itemTyres.filter(
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
          totalPrice: ((parseFloat(firstMatch.price) || 0) - (parseFloat(newItems[index].discount) || 0)) * (parseInt(newItems[index].quantity) || 0),
        };
        return newItems;
      });

      const fetchShopQuantity = async () => {
        const querySize = formItems[index].size || firstMatch.size || "";
        const purchasedQuery = query(
          collection(db, "purchasedTyres"),
          where("company", "==", formItems[index].company),
          where("brand", "==", formItems[index].brand),
          where("model", "==", model),
          where("size", "==", querySize)
        );
        try {
          const purchasedSnapshot = await getDocs(purchasedQuery);
          const purchasedTyres = purchasedSnapshot.docs.map((doc) => doc.data());
          const totalShopQty = purchasedTyres.reduce((acc, curr) => acc + (parseInt(curr.shop) || 0), 0);
          setFormItems((prev) => {
            const newItems = [...prev];
            newItems[index] = {
              ...newItems[index],
              shopQuantity: totalShopQty.toString(),
            };
            return newItems;
          });
        } catch (error) {
          console.error("Error fetching shop quantity:", error);
          toast.error("Failed to fetch shop quantity");
        }
      };
      fetchShopQuantity();
    } else {
      setAvailableSizes([]);
    }
  };

  const handleSizeChange = (e, index) => {
    const size = e.target.value;
    const match = itemTyres.find(
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
          comment: newItems[index].comment || "",
          totalPrice: ((parseFloat(match.price) || 0) - (parseFloat(newItems[index].discount) || 0)) * (parseInt(newItems[index].quantity) || 0),
        };
        return newItems;
      });

      const fetchShopQuantity = async () => {
        const purchasedQuery = query(
          collection(db, "purchasedTyres"),
          where("company", "==", formItems[index].company),
          where("brand", "==", formItems[index].brand),
          where("model", "==", formItems[index].model),
          where("size", "==", size)
        );
        try {
          const purchasedSnapshot = await getDocs(purchasedQuery);
          const purchasedTyres = purchasedSnapshot.docs.map((doc) => doc.data());
          const totalShopQty = purchasedTyres.reduce((acc, curr) => acc + (parseInt(curr.shop) || 0), 0);
          setFormItems((prev) => {
            const newItems = [...prev];
            newItems[index] = {
              ...newItems[index],
              shopQuantity: totalShopQty.toString(),
            };
            return newItems;
          });
        } catch (error) {
          console.error("Error fetching shop quantity:", error);
          toast.error("Failed to fetch shop quantity");
        }
      };
      fetchShopQuantity();
    } else {
      setFormItems((prev) => {
        const newItems = [...prev];
        newItems[index] = {
          ...newItems[index],
          size,
          shopQuantity: "",
          comment: newItems[index].comment || "",
          totalPrice: 0,
        };
        return newItems;
      });
    }
  };

  const addItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        ...initialItemState,
        customerName: prev[0]?.customerName || "",
        date: prev[0]?.date || new Date().toISOString().split("T")[0],
      },
    ]);
  };

  const removeItem = (index) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmSellTyre = async () => {
    for (const [index, item] of formItems.entries()) {
      if (!item.company || !item.brand || !item.model || !item.size || !item.price || !item.quantity || !item.customerName) {
        toast.error(`Please fill all fields for item ${index + 1}`);
        return;
      }

      const enteredQty = parseInt(item.quantity);
      if (enteredQty <= 0) {
        toast.error(`Quantity must be greater than 0 for item ${index + 1}`);
        return;
      }

      const shopQty = parseInt(item.shopQuantity) || 0;
      if (enteredQty > shopQty) {
        toast.error(`❌ Only ${shopQty} tyres available in shop for item ${index + 1}. Cannot sell more than that.`);
        return;
      }

      const matchedItems = itemTyres.filter(
        (t) =>
          t.company?.toLowerCase() === item.company.toLowerCase() &&
          t.brand?.toLowerCase() === item.brand.toLowerCase() &&
          t.model?.toLowerCase() === item.model.toLowerCase() &&
          t.size === item.size
      );

      const totalPurchasedQty = matchedItems.reduce((acc, curr) => acc + parseInt(curr.quantity || 0), 0);

      const matchedSold = sellTyres.filter(
        (t) =>
          t.company?.toLowerCase() === item.company.toLowerCase() &&
          t.brand?.toLowerCase() === item.brand.toLowerCase() &&
          t.model?.toLowerCase() === item.model.toLowerCase() &&
          t.size === item.size
      );

      const totalSoldQty = matchedSold.reduce((acc, curr) => acc + parseInt(curr.quantity || 0), 0);
      const availableQty = totalPurchasedQty - totalSoldQty;

      if (enteredQty > availableQty) {
        toast.error(`❌ Only ${availableQty} tyres available for item ${index + 1}. Cannot sell more than that.`);
        return;
      }
    }

    const newTransactionId = editTransactionId || uuidv4();
    const date = formItems[0].date || new Date().toISOString().split("T")[0];

    try {
      for (const item of formItems) {
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

        let remainingQty = parseInt(item.quantity);
        for (const tyre of purchasedTyres) {
          if (remainingQty <= 0) break;
          const currentShop = parseInt(tyre.shop) || 0;
          const deductQty = Math.min(currentShop, remainingQty);
          await updateDoc(doc(db, "purchasedTyres", tyre.id), {
            shop: currentShop - deductQty,
          });
          remainingQty -= deductQty;
        }

        const originalPrice = parseFloat(item.price);
        const discount = parseFloat(item.discount) || 0;
        const discountedPrice = originalPrice - discount;

        if (discountedPrice < 0) {
          toast.error(`Discount cannot exceed the original price for item ${item.company} ${item.brand}`);
          return;
        }

        const totalPrice = discountedPrice * parseInt(item.quantity);

        const newTyre = {
          ...item,
          price: discountedPrice,
          quantity: parseInt(item.quantity),
          status: "Sold",
          createdAt: editTransactionId ? item.createdAt || new Date() : new Date(),
          discount,
          payableAmount: totalPrice,
          transactionId: newTransactionId,
          date,
          comment: item.comment || "",
        };

        if (editTransactionId && item.id) {
          await updateDoc(doc(db, "soldTyres", item.id), {
            ...newTyre,
            payableAmount: totalPrice,
          });
        } else {
          await addDoc(collection(db, "soldTyres"), newTyre);
        }
      }

      toast.success(`Transaction ${editTransactionId ? "updated" : "created"} successfully`);
      setFormItems([initialItemState]);
      setCustomerSearch("");
      setEditTransactionId(null);
      setEditingTyres(null);
      setAvailableBrands([]);
      setAvailableModels([]);
      setAvailableSizes([]);
      setTransactionId(null);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast.error("Failed to save transaction: " + error.message);
    }
  };

  const handleSellTyre = () => {
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

  const groupedByTransaction = filteredTyres.reduce((acc, tyre) => {
    const tid = tyre.transactionId || tyre.id;
    if (!acc[tid]) {
      acc[tid] = [];
    }
    acc[tid].push(tyre);
    return acc;
  }, {});

  const transactions = Object.entries(groupedByTransaction).map(([tid, items]) => ({
    transactionId: tid,
    items,
    customerName: items[0]?.customerName || "N/A",
    date: items[0]?.date || "",
    brands: items.map(item => item.brand).join(", "),
    models: items.map(item => item.model).join(", "),
    sizes: items.map(item => item.size).join(", "),
    quantities: items.map(item => item.quantity).join(", "),
    prices: items.map(item => `Rs. ${item.price.toFixed(2)}`).join(", "),
    discounts: items.map(item => `Rs. ${item.discount || 0}`).join(", "),
    totalPayable: items.reduce((sum, item) => sum + (item.payableAmount || item.price * item.quantity), 0),
  }));

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const getCustomerDetails = (customerName) => {
    const customer = customers.find(c => c.name.toLowerCase() === customerName?.toLowerCase?.());
    return customer ? { address: customer.address, phone: customer.phone } : { address: "Not provided", phone: "Not provided" };
  };

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-600 mb-6">🛒 Sell Tyres</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name</label>
        <input
          type="text"
          value={customerSearch}
          onChange={handleCustomerSearch}
          onFocus={() => setIsCustomerDropdownOpen(true)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
          placeholder="Search customer..."
        />
        {isCustomerDropdownOpen && (
          <div ref={customerDropdownRef} className="absolute bg-white border border-gray-300 rounded-lg shadow-lg mt-1 w-64 max-h-40 overflow-y-auto z-10">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCustomerSelect(customer.name)}
                  className="p-2 hover:bg-blue-50 cursor-pointer text-gray-700"
                >
                  {customer.name}
                </div>
              ))
            ) : (
              <div className="p-2 text-gray-500">No customers found</div>
            )}
          </div>
        )}
      </div>

      {formItems.map((item, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow-md mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Item {index + 1}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <select
                name="company"
                value={item.company}
                onChange={(e) => handleCompanyChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">Select Company</option>
                {availableCompanies.map((company, idx) => (
                  <option key={idx} value={company}>{company}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Brand</label>
              <select
                name="brand"
                value={item.brand}
                onChange={(e) => handleBrandChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">Select Brand</option>
                {availableBrands.map((brand, idx) => (
                  <option key={idx} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Model</label>
              <select
                name="model"
                value={item.model}
                onChange={(e) => handleModelChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">Select Model</option>
                {availableModels.map((model, idx) => (
                  <option key={idx} value={model}>{model}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Size</label>
              <select
                name="size"
                value={item.size}
                onChange={(e) => handleSizeChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">Select Size</option>
                {availableSizes.map((size, idx) => (
                  <option key={idx} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Price</label>
              <input
                type="number"
                name="price"
                value={item.price}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={item.quantity}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Discount</label>
              <input
                type="number"
                name="discount"
                value={item.discount}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Price</label>
              <input
                type="number"
                name="totalPrice"
                value={item.totalPrice.toFixed(2)}
                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Shop Quantity</label>
              <input
                type="number"
                name="shopQuantity"
                value={item.shopQuantity}
                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                name="date"
                value={item.date}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Comment</label>
              <input
                type="text"
                name="comment"
                value={item.comment}
                onChange={(e) => handleChange(e, index)}
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
      <div className="flex space-x-4 mb-6">
        <button
          onClick={addItem}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
        >
          Add Item
        </button>
        <button
          onClick={handleSellTyre}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        >
          {editTransactionId ? "Update Transaction" : "Sell Items"}
        </button>
      </div>

      {showConfirmPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Confirm Transaction</h2>
            <div className="mb-4">
              <p className="text-gray-700"><strong>Customer:</strong> {formItems[0]?.customerName || "N/A"}</p>
              <p className="text-gray-700 mt-2"><strong>Items:</strong></p>
              <ul className="list-disc pl-5 text-gray-700">
                {formItems.map((item, idx) => (
                  <li key={idx}>
                    {item.company} {item.brand} {item.model} ({item.size}) - Qty: {item.quantity}, Total: Rs. {item.totalPrice?.toLocaleString() || 0}
                  </li>
                ))}
              </ul>
              <p className="text-gray-700 mt-2"><strong>Total:</strong> Rs. {formItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toLocaleString()}</p>
            </div>
            <p className="text-gray-600 mb-4">Is this correct?</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleCancelSell}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSell}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <input
          type="text"
          placeholder="Search sold items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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

        {loading ? (
          <div className="text-center py-4 text-gray-600">Loading sold items...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Customer</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Brands</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Models</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Sizes</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Quantities</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Prices</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Discounts</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Total</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-2 border text-left text-sm font-semibold text-gray-700">Actions</th>
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
                        <td className="px-4 py-2 border text-gray-600">{transaction.prices}</td>
                        <td className="px-4 py-2 border text-gray-600">{transaction.discounts}</td>
                        <td className="px-4 py-2 border text-gray-600">Rs. {transaction.totalPayable.toLocaleString()}</td>
                        <td className="px-4 py-2 border text-gray-600">{transaction.date}</td>
                        <td className="px-4 py-2 border">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                const items = transaction.items.map(t => ({
                                  ...t,
                                  totalPrice: ((parseFloat(t.price) || 0) - (parseFloat(t.discount) || 0)) * (parseInt(t.quantity) || 0),
                                }));
                                setFormItems(items);
                                setCustomerSearch(transaction.customerName);
                                setEditTransactionId(transaction.transactionId);
                                setEditingTyres(items);
                                setTransactionId(transaction.transactionId);
                              }}
                              className="px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setViewTransaction({
                                transactionId: transaction.transactionId,
                                customerName: transaction.customerName,
                                date: transaction.date,
                                items: transaction.items,
                                totalPayable: transaction.totalPayable,
                              })}
                              className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="px-4 py-2 text-center text-gray-600">No transactions found.</td>
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
          </>
        )}
      </div>

      {viewTransaction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div ref={printRef} className="invoice-container">
              <div className="header text-center mb-6 border-b-2 border-blue-600 pb-4">
                <h1 className="text-3xl font-bold text-blue-600">Srhad Tyres Traders</h1>
                <div className="invoice-info text-gray-600 mt-2 flex justify-between">
                  <p>Sell Invoice</p>
                  <p>Date: {viewTransaction.date}</p>
                </div>
              </div>
              <div className="section mb-6">
                <h3 className="section-title text-xl font-semibold text-blue-600 mb-3">Customer Details</h3>
                <div className="customer-details grid gap-2 text-gray-700">
                  <p><strong>Name:</strong> {viewTransaction.customerName || 'N/A'}</p>
                  <p><strong>Address:</strong> {getCustomerDetails(viewTransaction.customerName).address}</p>
                  <p><strong>Phone:</strong> {getCustomerDetails(viewTransaction.customerNumber).phone}</p>
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
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Price</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Quantity</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Discount</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewTransaction.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.brand}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.model}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.size}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">Rs. {item.price.toFixed(2)}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.quantity}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">Rs. {item.discount || 0}</td>
                          <td className="border border-gray-200 px-4 py-2 text-gray-600">Rs. {(item.payableAmount || item.price * item.quantity).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="section">
                <div className="total-section flex justify-end">
                  <div className="total-box bg-gray-50 p-4 rounded-lg w-80">
                    <p className="font-bold">Total : {viewTransaction.totalPayable.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="footer text-center mt-6 border-t border-gray-200 pt-4 text-gray-600">
                <p className="font-semibold">Thank you for your business!</p>
                <p>Phone: 0307-7717613 | Sher Shah Road Near Masjid Al Qadir Dera Adda, Multan, Pakistan </p>
                <p>Terms: Payment due within 30 days. All sales are final.</p>
                <p className="status font-semibold text-green-600">Status: Sold</p>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                Print Invoice
              </button>
              <button
                onClick={() => setViewTransaction(null)}
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

export default SellTyre;