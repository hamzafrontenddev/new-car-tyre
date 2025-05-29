import React, { useEffect, useState, useRef } from "react";
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

const Return = () => {
  const [soldTyres, setSoldTyres] = useState([]);
  const [returns, setReturns] = useState([]);
  const [manualReturnPrice, setManualReturnPrice] = useState("");
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("");
  const [discount, setDiscount] = useState("");
  const [due, setDue] = useState("");
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerInputRef = useRef(null);
  const itemsPerPage = 5;
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "soldTyres"), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setSoldTyres(data);
      console.log("soldTyres:", data);
    });

    const unsub2 = onSnapshot(collection(db, "returnedTyres"), (snapshot) => {
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data = filterByDateRange(data, startDate, endDate);
      setReturns(data);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [startDate, endDate]);

  const customers = [...new Set(soldTyres.map((t) => t.customerName).filter((c) => c && c.trim() !== ""))];
  const companies = [
    ...new Set(
      soldTyres.filter((t) => t.customerName === selectedCustomer).map((t) => t.company)
    ),
  ];
  const brands = [
    ...new Set(
      soldTyres
        .filter((t) => t.customerName === selectedCustomer && t.company === selectedCompany)
        .map((t) => t.brand)
    ),
  ];
  const models = [
    ...new Set(
      soldTyres
        .filter((t) =>
          t.customerName === selectedCustomer &&
          t.company === selectedCompany &&
          t.brand === selectedBrand
        )
        .map((t) => t.model)
    ),
  ];
  const sizes = [
    ...new Set(
      soldTyres
        .filter((t) =>
          t.customerName === selectedCustomer &&
          t.company === selectedCompany &&
          t.brand === selectedBrand &&
          t.model === selectedModel
        )
        .map((t) => t.size)
    ),
  ];

  useEffect(() => {
    const match = soldTyres.find(
      (t) =>
        t.customerName === selectedCustomer &&
        t.company === selectedCompany &&
        t.brand === selectedBrand &&
        t.model === selectedModel &&
        t.size === selectedSize
    );

    if (match) {
      setPrice(match.price);
      setQuantity(match.quantity);
      setDiscount(match.discount || 0);
      setDue(match.due || 0);
    } else {
      setPrice("");
      setQuantity("");
      setDiscount("");
      setDue("");
    }
  }, [selectedCustomer, selectedCompany, selectedBrand, selectedModel, selectedSize, soldTyres]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }
    if (!selectedCompany) {
      toast.error("Please select a company");
      return;
    }
    if (!selectedBrand) {
      toast.error("Please select a brand");
      return;
    }
    if (!selectedModel) {
      toast.error("Please select a model");
      return;
    }
    if (!selectedSize) {
      toast.error("Please select a size");
      return;
    }
    if (!returnQuantity || returnQuantity <= 0) {
      toast.error("Please enter a valid return quantity");
      return;
    }
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    const returnTyre = {
      customer: selectedCustomer,
      company: selectedCompany,
      brand: selectedBrand,
      model: selectedModel,
      size: selectedSize,
      price: Number(price),
      quantity: Number(quantity),
      totalPrice: Number(price) * Number(quantity),
      returnQuantity: Number(returnQuantity),
      returnPrice: Number(manualReturnPrice),
      returnTotalPrice: Number(manualReturnPrice) * Number(returnQuantity),
      date,
      discount: Number(discount),
      due: Number(due),
      comment: comment || "",
    };

    try {
      await addDoc(collection(db, "returnedTyres"), returnTyre);

      const purchasedQuery = query(
        collection(db, "purchasedTyres"),
        where("company", "==", selectedCompany),
        where("brand", "==", selectedBrand),
        where("model", "==", selectedModel),
        where("size", "==", selectedSize)
      );
      const purchasedSnapshot = await getDocs(purchasedQuery);
      const purchasedTyres = purchasedSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (purchasedTyres.length === 0) {
        toast.error("No matching tyre found in purchasedTyres");
        return;
      }

      if (Number(returnQuantity) > Number(quantity)) {
        toast.error("Return quantity cannot exceed original sold quantity");
        return;
      }

      const targetTyre = purchasedTyres[0];
      const currentShop = parseInt(targetTyre.shop) || 0;
      const newShopQuantity = currentShop + Number(returnQuantity);

      await updateDoc(doc(db, "purchasedTyres", targetTyre.id), {
        shop: newShopQuantity,
      });
      console.log(`Added ${returnQuantity} to shop quantity for tyre ID: ${targetTyre.id}`);
      toast.success(`Shop quantity updated to ${newShopQuantity}`);

      toast.success("Tyre returned successfully!");
      setManualReturnPrice("");
      setSelectedCustomer("");
      setSelectedCompany("");
      setSelectedBrand("");
      setSelectedModel("");
      setSelectedSize("");
      setPrice("");
      setQuantity("");
      setReturnQuantity("");
      setDiscount("");
      setDue("");
      setDate("");
      setComment("");
      setShowCustomerDropdown(false);
    } catch (err) {
      toast.error("Error returning tyre.");
    }
  };

  const filteredReturns = returns.filter((t) =>
    `${t.customer} ${t.company} ${t.brand} ${t.model} ${t.size} ${t.customer}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredReturns.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredReturns.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">🛒 Return Item</h2>

      <form className="grid grid-cols-3 gap-4 mb-6" onSubmit={handleSubmit}>
        <div className="relative">
          <input
            ref={customerInputRef}
            type="text"
            placeholder="Search or select customer..."
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            onFocus={() => setShowCustomerDropdown(true)}
            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
            className="border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {showCustomerDropdown && (
            <div className="absolute z-10 w-full bg-white border border-gray-300 rounded mt-1 max-h-40 overflow-y-auto">
              {customers
                .filter((c) =>
                  c.toLowerCase().includes(selectedCustomer.toLowerCase())
                )
                .map((c) => (
                  <div
                    key={c}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setShowCustomerDropdown(false);
                      customerInputRef.current?.blur();
                    }}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {c}
                  </div>
                ))}
            </div>
          )}
        </div>

        <select
          className="border border-gray-300 rounded px-3 py-2"
          value={selectedCompany}
          onChange={(e) => {
            setSelectedCompany(e.target.value);
            setSelectedBrand("");
            setSelectedModel("");
            setSelectedSize("");
          }}
        >
          <option>Select Company</option>
          {companies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select
          className="border border-gray-300 rounded px-3 py-2"
          value={selectedBrand}
          onChange={(e) => {
            setSelectedBrand(e.target.value);
            setSelectedModel("");
            setSelectedSize("");
          }}
        >
          <option>Select Brand</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>

        <select
          className="border border-gray-300 rounded px-3 py-2"
          value={selectedModel}
          onChange={(e) => {
            setSelectedModel(e.target.value);
            setSelectedSize("");
          }}
        >
          <option>Select Model</option>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>

        <select
          className="border border-gray-300 rounded px-3 py-2"
          value={selectedSize}
          onChange={(e) => setSelectedSize(e.target.value)}
        >
          <option>Select Size</option>
          {sizes.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Price"
          value={price}
          readOnly
          className="border border-gray-300 bg-gray-100 rounded px-3 py-2"
        />

        <input
          type="text"
          placeholder="Quantity"
          value={quantity}
          readOnly
          className="border border-gray-300 bg-gray-100 rounded px-3 py-2"
        />
        <input
          type="number"
          placeholder="Return Quantity"
          value={returnQuantity}
          onChange={(e) => setReturnQuantity(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        />
        <input
          type="number"
          placeholder="Return Price"
          value={manualReturnPrice}
          onChange={(e) => setManualReturnPrice(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Discount"
          value={discount}
          readOnly
          className="border border-gray-300 bg-gray-100 rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Due Amount"
          value={due}
          readOnly
          className="border border-gray-300 bg-gray-100 rounded px-3 py-2"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder="Add Comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-full"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white font-semibold rounded px-6 py-2 hover:bg-blue-700 transition"
        >
          Return Tyre
        </button>
      </form>

      <div className="flex justify-between">
        <input
          type="text"
          placeholder="🔍 Search by customer name, company, brand, model, size..."
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
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 font-semibold">Customer</th>
              <th className="py-2 px-4 font-semibold">Company</th>
              <th className="py-2 px-4 font-semibold">Brand</th>
              <th className="py-2 px-4 font-semibold">Model</th>
              <th className="py-2 px-4 font-semibold">Size</th>
              <th className="py-2 px-4 font-semibold">Quantity</th>
              <th className="py-2 px-4 font-semibold">Price</th>
              <th className="py-2 px-4 font-semibold">Total Price</th>
              <th className="py-2 px-4 font-semibold">Return Quantity</th>
              <th className="py-2 px-4 font-semibold">Return Price</th>
              <th className="py-2 px-4 font-semibold">Return Total Price</th>
              <th className="py-2 px-4 font-semibold">Discount</th>
              <th className="py-2 px-4 font-semibold">Due</th>
              <th className="py-2 px-4 font-semibold">Date</th>
              <th className="py-2 px-4 font-semibold min-w-[200px]">Comment</th>
              <th className="py-2 px-4 font-semibold">Action</th>
            </tr>
          </thead>

          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((t) => (
                <tr key={t.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-2 px-4">{t.customer}</td>
                  <td className="py-2 px-4">{t.company}</td>
                  <td className="py-2 px-4">{t.brand}</td>
                  <td className="py-2 px-4">{t.model}</td>
                  <td className="py-2 px-4">{t.size}</td>
                  <td className="py-2 px-4">{t.quantity}</td>
                  <td className="py-2 px-4">Rs. {t.price}</td>
                  <td className="py-2 px-4">Rs. {t.totalPrice}</td>
                  <td className="py-2 px-4">{t.returnQuantity}</td>
                  <td className="py-2 px-4">Rs. {t.returnPrice}</td>
                  <td className="py-2 px-4">Rs. {t.returnTotalPrice}</td>
                  <td className="py-2 px-4">{`${t.discount || 0}`}</td>
                  <td className="py-2 px-4">Rs. {t.due || 0}</td>
                  <td className="py-2 px-4">{t.date}</td>
                  <td className="py-2 px-4 min-w-[200px]">
                    <textarea
                      value={t.comment || ""}
                      readOnly
                      rows="2"
                      className="border border-gray-300 p-2 rounded w-full min-w-[200px] resize-none"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => setSelectedReturn(t)}
                      className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="16" className="text-center py-4 text-gray-500">
                  No returns found.
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

      {selectedReturn && (
  <div className="fixed inset-0 min-h-screen bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-8 relative font-sans">
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm; /* Page margin for A4 */
            }
            body {
              background: white !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-only-container {
              width: 180mm !important; /* Adjusted to fit within A4 after page margins */
              max-width: 180mm !important;
              padding: 10mm !important; /* Consistent padding for print */
              margin: 0 auto !important; /* Centered on the page */
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: white !important;
            }
            .invoice-header {
              background: #2563eb !important; /* Fallback for gradient */
              padding: 8mm !important;
              margin-bottom: 5mm !important;
              border-radius: 0 !important;
              color: white !important;
            }
            .invoice-section {
              margin-bottom: 5mm !important;
            }
            .invoice-section h3 {
              font-size: 11pt !important;
              padding-bottom: 2mm !important;
              margin-bottom: 3mm !important;
              border-bottom: 1px solid #e5e7eb !important;
            }
            .invoice-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 5mm !important;
              font-size: 9pt !important;
            }
            .invoice-grid p {
              margin: 0 !important;
              line-height: 1.3 !important;
            }
            .invoice-note {
              font-size: 8pt !important;
              color: #6b7280 !important;
              text-align: center !important;
              margin-top: 5mm !important;
              margin-bottom: 0 !important;
            }
            .screen-only {
              display: block !important;
            }
            .print-only {
              display: none !important;
            }
            @media print {
              .screen-only {
                display: none !important;
              }
              .print-only {
                display: block !important;
              }
              .print-only-container * {
                box-sizing: border-box !important;
              }
            }
          }
        `}
      </style>

      {/* Custom Print Function */}
      {(() => {
        const handlePrint = () => {
          // Create a temporary print-only container
          const printContent = document.createElement('div');
          printContent.className = 'print-only print-only-container';

          // Clone the invoice content (without screen-only elements)
          const invoiceContent = document.querySelector('.print-content').cloneNode(true);
          // Remove screen-only elements (like buttons) from the clone
          invoiceContent.querySelectorAll('.screen-only').forEach(el => el.remove());
          printContent.appendChild(invoiceContent);

          // Append to body for printing
          document.body.appendChild(printContent);

          // Hide everything else
          document.querySelectorAll('body > *:not(.print-only)').forEach(el => {
            el.style.display = 'none';
          });

          // Trigger print
          window.print();

          // Restore visibility and cleanup
          document.querySelectorAll('body > *:not(.print-only)').forEach(el => {
            el.style.display = '';
          });
          document.body.removeChild(printContent);
        };

        return (
          <div className="print-content">
            {/* Header */}
            <div className="invoice-header bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-3xl font-bold print:text-xl">Srhad Tyre Treaders</h2>
              <div className="text-sm print:text-[9pt]">
                <p>Date: <time>{selectedReturn.date}</time></p>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="invoice-section mb-6">
              <div className="invoice-grid grid grid-cols-1 md:grid-cols-2 gap-8 text-gray-700">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Customer Details</h3>
                  <p><span className="font-medium">Name:</span> {selectedReturn.customer || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Tire Details</h3>
                  <p><span className="font-medium">Brand:</span> {selectedReturn.brand}</p>
                  <p><span className="font-medium">Model:</span> {selectedReturn.model}</p>
                  <p><span className="font-medium">Size:</span> {selectedReturn.size}</p>
                </div>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="invoice-section mb-6">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Pricing Summary</h3>
              <div className="invoice-grid grid grid-cols-2 gap-x-6 gap-y-3 text-gray-700">
                <p className="font-medium">Original Quantity:</p>
                <p>{selectedReturn.quantity}</p>
                <p className="font-medium">Returned Quantity:</p>
                <p>{selectedReturn.returnQuantity}</p>
                <p className="font-medium">Price per Tire:</p>
                <p>Rs. {selectedReturn.price}</p>
                <p className="font-medium">Return Price per Tire:</p>
                <p>Rs. {selectedReturn.returnPrice}</p>
                <p className="font-medium">Discount:</p>
                <p>Rs. {selectedReturn.discount || 0}</p>
                <p className="font-medium">Due Amount:</p>
                <p>Rs. {selectedReturn.due || 0}</p>
                <p className="font-medium text-lg text-gray-800 print:text-base">Total Return Amount:</p>
                <p className="font-medium text-lg text-gray-800 print:text-base">Rs. {selectedReturn.returnTotalPrice}</p>
              </div>
            </div>

            {/* Note */}
            <div className="invoice-note text-center mb-6">
              <p className="text-sm text-gray-500">Note: We provide a wide range of imported tires and rims for all types of vehicles.</p>
            </div>

            {/* Buttons (Hidden on Print) */}
            <div className="screen-only flex justify-between items-center text-gray-600 text-sm mt-6">
              <p>Status: <span className="font-semibold text-green-600">Returned</span></p>
              <div className="flex gap-3">
                <button
                  onClick={handlePrint}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  aria-label="Print Invoice"
                >
                  Print Invoice
                </button>
                <button
                  onClick={() => setSelectedReturn(null)}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  aria-label="Close Invoice"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  </div>
)}
    </div>
  );
};

export default Return;