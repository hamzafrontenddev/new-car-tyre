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
  return data.filter((item) => {
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
    due: "",
    shopQuantity: "",
    comment: "",
    customerName: "",
    date: new Date().toISOString().split("T")[0],
    totalPrice: 0,
  };

  const [formItems, setFormItems] = useState([initialItemState]);
  const [transactionBank, setTransactionBank] = useState("");
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
  const [availableSizes, setAvailableSizes] = useState([]);
  const [viewTransaction, setViewTransaction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const customerDropdownRef = useRef(null);
  const itemsPerPage = 10;

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
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            <style>
              @media print {
                .print\\:hidden { display: none; }
                body { margin: 0; padding: 20px; }
                .invoice-container { max-width: 800px; margin: auto; }
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
        const snapshot = await getDocs(collection(db, "purchasedTyres"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setItemTyres(data);
        setAvailableCompanies([...new Set(data.map((t) => t.company?.toLowerCase()))]);
      } catch (error) {
        console.error("Error fetching purchased tyres:", error);
        toast.error("Failed to load purchased tyres");
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
        totalPrice: ((parseFloat(item.price) || 0) - (parseFloat(item.discount) || 0)) * (parseInt(item.quantity) || 0) - (parseFloat(item.due) || 0),
      })));
      setCustomerSearch(editingTyres[0]?.customerName || "");
      setTransactionBank(editingTyres[0]?.bank || "");
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
            due: tyre.due || "",
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
      const due = parseFloat(newItems[index].due) || 0;
      const discountedPrice = price - discount;
      newItems[index].totalPrice = discountedPrice >= 0 ? (discountedPrice * quantity - due) : 0;
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
      setFormItems(prev => prev.map(item => ({ ...item, customerName: "" })));
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
        due: newItems[index].due || "",
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
        due: newItems[index].due || "",
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
        due: newItems[index].due || "",
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
          totalPrice: ((parseFloat(firstMatch.price) || 0) - (parseFloat(newItems[index].discount) || 0)) * (parseInt(newItems[index].quantity) || 0) - (parseFloat(newItems[index].due) || 0),
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
          due: newItems[index].due || "",
          comment: "",
          totalPrice: ((parseFloat(match.price) || 0) - (parseFloat(newItems[index].discount) || 0)) * (parseInt(newItems[index].quantity) || 0) - (parseFloat(newItems[index].due) || 0),
        };
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
          due: newItems[index].due || "",
          comment: "",
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
    const shopQty = parseInt(item.shopQuantity);

    if (enteredQty > shopQty) {
      toast.error(`❌ Only ${shopQty} tyres available in shop for item ${index + 1}. Cannot sell more than that.`);
      return;
    }
  }

  const newTransactionId = editTransactionId || uuidv4();
  const date = formItems[0].date || new Date().toISOString().split("T")[0];
  const customerName = formItems[0].customerName.toLowerCase().trim();
  let descriptions = [];

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
      const purchasedTyres = purchasedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let remainingQty = parseInt(item.quantity);
      for (const tyre of purchasedTyres) {
        if (remainingQty <= 0) break;
        const availableQty = parseInt(tyre.shop) || 0;
        if (availableQty > 0) {
          const deductQty = Math.min(availableQty, remainingQty);
          await updateDoc(doc(db, "purchasedTyres", tyre.id), {
            shop: availableQty - deductQty,
          });
          remainingQty -= deductQty;
        }
      }

      const totalPayable = item.totalPrice || ((parseFloat(item.price) || 0) - (parseFloat(item.discount) || 0)) * (parseInt(item.quantity) || 0) - (parseFloat(item.due) || 0);

      const soldTyreData = {
        transactionId: newTransactionId,
        company: item.company,
        brand: item.brand,
        model: item.model,
        size: item.size,
        price: parseFloat(item.price) || 0,
        quantity: parseInt(item.quantity) || 0,
        discount: parseFloat(item.discount) || 0,
        due: parseFloat(item.due) || 0,
        comment: item.comment || "",
        bank: transactionBank || "",
        customerName: item.customerName,
        date,
        createdAt: new Date(),
        payableAmount: totalPayable,
      };

      if (editTransactionId) {
        const soldQuery = query(
          collection(db, "soldTyres"),
          where("transactionId", "==", editTransactionId),
          where("company", "==", item.company),
          where("brand", "==", item.brand),
          where("model", "==", item.model),
          where("size", "==", item.size)
        );
        const soldSnapshot = await getDocs(soldQuery);
        if (!soldSnapshot.empty) {
          await updateDoc(soldSnapshot.docs[0].ref, soldTyreData);
        } else {
          await addDoc(collection(db, "soldTyres"), soldTyreData);
        }
      } else {
        await addDoc(collection(db, "soldTyres"), soldTyreData);
      }

      descriptions.push(`${item.quantity} ${item.brand} ${item.size}`);
    }

    // Calculate totals
    const totalDebit = formItems.reduce((sum, item) => {
      const price = (parseFloat(item.price) || 0) - (parseFloat(item.discount) || 0);
      return sum + price * (parseInt(item.quantity) || 0);
    }, 0);

    const totalDue = formItems.reduce((sum, item) => sum + (parseFloat(item.due) || 0), 0);
    const totalCredit = totalDebit - totalDue;

    // Add Ledger Entry - SALE
    if (totalDebit > 0) {
      await addDoc(collection(db, "customerLedgerEntries"), {
        customerName,
        date,
        narration: `Sale_${newTransactionId}`,
        description: `Tyres sold: ${descriptions.join(", ")}`,
        debit: totalDebit,
        credit: 0,
        createdAt: new Date(),
        invoiceNumber: newTransactionId,
        paymentMethod: transactionBank ? "Bank" : "Cash",
        bankName: transactionBank || "",
      });
    }

    // Add Ledger Entry - PAYMENT
    if (totalCredit > 0) {
      await addDoc(collection(db, "customerLedgerEntries"), {
        customerName,
        date,
        narration: `Payment_${newTransactionId}`,
        description: transactionBank ? `Payment via ${transactionBank}` : "Payment via CASH",
        debit: 0,
        credit: totalCredit,
        createdAt: new Date(),
        invoiceNumber: newTransactionId,
        paymentMethod: transactionBank ? "Bank" : "Cash",
        bankName: transactionBank || "",
      });
    }

    // Update or Add customerDetails
    const customerQuery = query(collection(db, "customerDetails"), where("customerName", "==", customerName));
    const customerSnapshot = await getDocs(customerQuery);

    if (!customerSnapshot.empty) {
      const customerDoc = customerSnapshot.docs[0];
      const prevPaid = parseFloat(customerDoc.data().totalPaid) || 0;
      const newTotalPaid = prevPaid + totalCredit;
      const newDue = Math.max(0, totalDebit - newTotalPaid);

      await updateDoc(customerDoc.ref, {
        totalPaid: newTotalPaid,
        due: newDue,
      });
    } else {
      await addDoc(collection(db, "customerDetails"), {
        customerName,
        totalPaid: totalCredit,
        due: Math.max(0, totalDebit - totalCredit),
      });
    }

    // Final UI Reset
    setFormItems([initialItemState]);
    setCustomerSearch("");
    setTransactionBank("");
    setEditTransactionId(null);
    setEditingTyres(null);
    setTransactionId(newTransactionId);
    setViewTransaction({
      transactionId: newTransactionId,
      customerName: formItems[0].customerName,
      date,
      bank: transactionBank || "",
      items: formItems.map(item => ({
        ...item,
        payableAmount: item.totalPrice,
        bank: transactionBank,
      })),
      totalPayable: formItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
    });
    toast.success(editTransactionId ? "Transaction updated successfully!" : "Tyres sold successfully!");
  } catch (error) {
    console.error("Error processing sale:", error);
    toast.error("Error processing sale: " + error.message);
  }
};




  const handleSellTyre = (e) => {
    e.preventDefault();
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

  const groupedByTransaction = filteredTyres.reduce((acc, item) => {
    const tid = item.transactionId || item.id;
    if (!acc[tid]) {
      acc[tid] = [];
    }
    acc[tid].push(item);
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
    bank: items[0]?.bank || "No Payment",
    comment: items[0]?.comment || "",
    totalPayable: items.reduce((sum, item) => sum + (item.payableAmount || ((parseFloat(item.price) || 0) - (parseFloat(item.discount) || 0)) * (parseInt(item.quantity) || 0) - (parseFloat(item.due) || 0)), 0),
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

  const calculateInvoiceTotals = (items) => {
    const totalAmount = items.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      const discount = parseFloat(item.discount) || 0;
      const quantity = parseInt(item.quantity) || 0;
      return sum + ((price - discount) * quantity);
    }, 0);
    const totalDues = items.reduce((sum, item) => sum + (parseFloat(item.due) || 0), 0);
    const totalPaid = totalAmount - totalDues;
    return { totalAmount, totalDues, totalPaid };
  };

  const calculateBrandTotals = (items) => {
    const brandTotals = {};
    items.forEach(item => {
      const brand = item.brand || "Unknown";
      const price = parseFloat(item.price) || 0;
      const discount = parseFloat(item.discount) || 0;
      const quantity = parseInt(item.quantity) || 0;
      const amount = (price - discount) * quantity;
      brandTotals[brand] = (brandTotals[brand] || 0) + amount;
    });
    return brandTotals;
  };

  const hasDiscount = (items) => {
    return items.some(item => (parseFloat(item.discount) || 0) > 0);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">🛒 Sell Tyres</h2>
      <div className="mb-6">
        <label className="block text-gray-700 font-medium mb-2">Customer Name</label>
        <input
          type="text"
          value={customerSearch}
          onChange={handleCustomerSearch}
          onFocus={() => setIsCustomerDropdownOpen(true)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
          placeholder="Search customer..."
        />
        {isCustomerDropdownOpen && (
          <div
            ref={customerDropdownRef}
            className="absolute bg-white border border-gray-300 rounded-lg mt-1 w-64 max-h-60 overflow-y-auto z-10"
          >
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
        <div key={index} className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Item {index + 1}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Party</label>
              <select
                name="company"
                value={item.company}
                onChange={(e) => handleCompanyChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">Select Party</option>
                {availableCompanies.map((company, idx) => (
                  <option key={idx} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Brand</label>
              <select
                name="brand"
                value={item.brand}
                onChange={(e) => handleBrandChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">Select Brand</option>
                {availableBrands.map((brand, idx) => (
                  <option key={idx} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Model</label>
              <select
                name="model"
                value={item.model}
                onChange={(e) => handleModelChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">Select Model</option>
                {availableModels.map((model, idx) => (
                  <option key={idx} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Size</label>
              <select
                name="size"
                value={item.size}
                onChange={(e) => handleSizeChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">Select Size</option>
                {availableSizes.map((size, idx) => (
                  <option key={idx} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Price</label>
              <input
                type="number"
                name="price"
                value={item.price}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={item.quantity}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Discount</label>
              <input
                type="number"
                name="discount"
                value={item.discount}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Due</label>
              <input
                type="number"
                name="due"
                value={item.due}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                placeholder="Enter due amount"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Total Price</label>
              <input
                type="text"
                value={`Rs. ${item.totalPrice.toLocaleString()}`}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Shop Quantity</label>
              <input
                type="text"
                value={item.shopQuantity}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Date</label>
              <input
                type="date"
                name="date"
                value={item.date}
                onChange={(e) => handleChange(e, index)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Comment</label>
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

      <div className="mb-6">
        <label className="block text-gray-700 font-medium mb-2">Bank</label>
        <input
          type="text"
          value={transactionBank}
          onChange={(e) => setTransactionBank(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
          placeholder="Enter bank name"
        />
      </div>

      <div className="flex gap-4 mb-6">
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm Transaction</h3>
            <div className="mb-4">
              <p className="font-medium">Customer: {formItems[0]?.customerName || "N/A"}</p>
              <p className="font-medium">Bank: {transactionBank || "No Payment"}</p>
              <p className="font-medium">Items:</p>
              <ul className="list-disc pl-5">
                {formItems.map((item, idx) => (
                  <li key={idx}>
                    {item.company} {item.brand} {item.model} ({item.size}) - Qty: {item.quantity}, Total: Rs. {item.totalPrice?.toLocaleString() || 0}
                  </li>
                ))}
              </ul>
              <p className="font-medium mt-2">
                Total: Rs. {formItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toLocaleString()}
              </p>
            </div>
            <p className="mb-4">Is this correct?</p>
            <div className="flex justify-end gap-3">
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

      <div className="flex justify-between mb-6">
        <input
          type="text"
          placeholder="🔍 Search transactions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none mb-4"
        />
        <div className="flex gap-2">
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
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none pl-10"
              dateFormat="yyyy-MM-dd"
              isClearable
            />
            <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {loading ? (
        <div>Loading sold items...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 font-semibold">Customer</th>
                <th className="py-2 px-4 font-semibold">Brands</th>
                <th className="py-2 px-4 font-semibold">Models</th>
                <th className="py-2 px-4 font-semibold">Sizes</th>
                <th className="py-2 px-4 font-semibold">Quantities</th>
                <th className="py-2 px-4 font-semibold">Prices</th>
                <th className="py-2 px-4 font-semibold">Discounts</th>
                <th className="py-2 px-4 font-semibold">Bank</th>
                <th className="py-2 px-4 font-semibold">Total</th>
                <th className="py-2 px-4 font-semibold">Date</th>
                <th className="py-2 px-4 font-semibold">Actions</th>
                <th className="py-2 px-4 font-semibold">Comment</th>
              </tr>
            </thead>
            <tbody>
              {currentTransactions.length > 0 ? (
                currentTransactions.map((transaction) => (
                  <tr key={transaction.transactionId} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-4">{transaction.customerName}</td>
                    <td className="py-2 px-4">{transaction.brands}</td>
                    <td className="py-2 px-4">{transaction.models}</td>
                    <td className="py-2 px-4">{transaction.sizes}</td>
                    <td className="py-2 px-4">{transaction.quantities}</td>
                    <td className="py-2 px-4">{transaction.prices}</td>
                    <td className="py-2 px-4">{transaction.discounts}</td>
                    <td className="py-2 px-4">{transaction.bank}</td>
                    <td className="py-2 px-4">Rs. {transaction.totalPayable.toLocaleString()}</td>
                    <td className="py-2 px-4">{transaction.date}</td>
                    <td className="py-2 px-4">
                      <button
                        onClick={() => setViewTransaction({
                          transactionId: transaction.transactionId,
                          customerName: transaction.customerName,
                          date: transaction.date,
                          bank: transaction.bank,
                          items: transaction.items,
                          totalPayable: transaction.totalPayable,
                        })}
                        className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                      >
                        View
                      </button>
                    </td>
                    <td className="py-2 px-4">{transaction.comment}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="12" className="py-2 px-4 text-center">
                    No transactions found.
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
                className={`px-3 py-1 rounded-lg ${currentPage === number ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                {number}
              </button>
            ))}
          </div>
        </div>
      )}

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
                </div>
              </div>
              <div className="section">
                <h3 className="section-title text-xl font-semibold text-blue-600 mb-3">Item Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Brand</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Size</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Quntity</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Price</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Total Price</th>
                        {hasDiscount(viewTransaction.items) && (
                          <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Discount</th>
                        )}
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Total Paid</th>
                        <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewTransaction.items.map((item, idx) => {
                        const brandTotals = calculateBrandTotals(viewTransaction.items);
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.brand}</td>
                            <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.size}</td>
                            <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.quantity}</td>
                            <td className="border border-gray-200 px-4 py-2 text-gray-600"><span>{typeof item.price === 'number' ? item.price.toFixed(2) : '0.00'}</span></td>
                            <td className="border border-gray-200 px-4 py-2 text-gray-600">{(((parseFloat(item.price) || 0) - (parseFloat(item.discount) || 0)) * (parseInt(item.quantity) || 0)).toLocaleString()}</td>
                            {hasDiscount(viewTransaction.items) && (
                              <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.discount || 0}</td>
                            )}
                            <td className="border border-gray-200 px-4 py-2 text-gray-600">{(item.payableAmount || ((parseFloat(item.price) || 0) - (parseFloat(item.discount) || 0)) * (parseInt(item.quantity) || 0) - (parseFloat(item.due) || 0)).toLocaleString()}</td>
                            <td className="border border-gray-200 px-4 py-2 text-gray-600">{item.due || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="section">
                <div className="total-section flex justify-end">
                  <div className="total-box bg-gray-50 p-4 rounded-lg w-80">
                    <p>Total Amount: Rs. {calculateInvoiceTotals(viewTransaction.items).totalAmount.toLocaleString()}</p>
                    <p>Total Paid: Rs. {calculateInvoiceTotals(viewTransaction.items).totalPaid.toLocaleString()}</p>
                    <p>Total Dues: Rs. {calculateInvoiceTotals(viewTransaction.items).totalDues.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="footer text-center mt-6 border-t border-gray-200 pt-4 text-gray-600">
                <p className="font-semibold">Thank you for your business!</p>
                <p>Phone: 0307-7717613 | Sher Shah Road Near Masjid Al Qadir Dera Adda, Multan, Pakistan</p>
                <p>Status: Sold</p>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6 print:hidden">
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