import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-modal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { CalendarIcon } from '@heroicons/react/24/outline';

Modal.setAppElement('#root');

const CustomerLedger = () => {
  const [sellData, setSellData] = useState([]);
  const [customerDetails, setCustomerDetails] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saleSearchQuery, setSaleSearchQuery] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [addCustomerModalIsOpen, setAddCustomerModalIsOpen] = useState(false);
  const [ledgerModalIsOpen, setLedgerModalIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(5);
  const [customerFormData, setCustomerFormData] = useState({
    customerName: '',
    totalBrands: 0,
    totalItems: 0,
    totalCost: '',
    totalPaid: '',
    due: '',
    paymentMethod: '',
    bankName: '',
  });
  const [saleFilterDates, setSaleFilterDates] = useState({
    startDate: null,
    endDate: null,
  });
  const [ledgerFilterDates, setLedgerFilterDates] = useState({
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    const unsubscribeSell = onSnapshot(collection(db, 'soldTyres'), (snapshot) => {
      const sellList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date || Date.now())
      }));
      setSellData(sellList);
    });

    const unsubscribeCustomerDetails = onSnapshot(collection(db, 'customerDetails'), (snapshot) => {
      const detailsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomerDetails(detailsList);
    });

    const unsubscribeLedger = onSnapshot(collection(db, 'customerLedgerEntries'), (snapshot) => {
      const ledgerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLedgerEntries(ledgerList);
    });

    return () => {
      unsubscribeSell();
      unsubscribeCustomerDetails();
      unsubscribeLedger();
    };
  }, []);

  const customerSummary = useMemo(() => {
    const customerMap = {};

    sellData.forEach(item => {
      const customer = item.customerName || 'N/A';
      if (!customerMap[customer]) {
        customerMap[customer] = { totalItems: 0, totalCost: 0, brands: {} };
      }
      const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
      customerMap[customer].totalItems += item.quantity;
      customerMap[customer].totalCost += item.price * item.quantity;
      if (!customerMap[customer].brands[item.brand]) {
        customerMap[customer].brands[item.brand] = { totalItems: 0, totalCost: 0, sizes: new Set(), dates: new Set() };
      }
      customerMap[customer].brands[item.brand].totalItems += item.quantity;
      customerMap[customer].brands[item.brand].totalCost += item.price * item.quantity;
      if (item.size) customerMap[customer].brands[item.brand].sizes.add(item.size);
      if (item.date) customerMap[customer].brands[item.brand].dates.add(item.date.toISOString().split('T')[0]);
    });

    return Object.keys(customerMap).map(customer => {
      const details = customerDetails.find(detail => detail.customerName === customer) || {};
      const totalCost = customerMap[customer].totalCost;
      const totalPaid = parseFloat(details.totalPaid) || 0;
      const due = (totalCost - totalPaid).toFixed(2);
      return {
        customer,
        totalItems: customerMap[customer].totalItems,
        totalCost,
        totalPaid,
        due: parseFloat(due) >= 0 ? parseFloat(due) : 0,
        brands: customerMap[customer].brands,
      };
    });
  }, [sellData, customerDetails]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customerSummary;

    const queries = searchQuery.toLowerCase().split(/\s+/).filter(q => q);

    return customerSummary.filter(item => {
      return queries.every(query => {
        const numQuery = parseFloat(query);
        const isNumeric = !isNaN(numQuery);

        return (
          item.customer.toLowerCase().includes(query) ||
          (isNumeric && Math.abs(item.totalItems - numQuery) <= 10) ||
          (isNumeric && Math.abs(item.totalCost - numQuery) <= 1000) ||
          (isNumeric && Math.abs(item.totalPaid - numQuery) <= 1000) ||
          (isNumeric && Math.abs(item.due - numQuery) <= 1000)
        );
      });
    });
  }, [customerSummary, searchQuery]);

  const getSaleSummary = (customerName) => {
    const customer = customerSummary.find(item => item.customer === customerName);
    if (!customer) return [];

    const saleSizeMap = {};

    sellData
      .filter(item => (item.customerName || 'N/A') === customerName)
      .forEach(item => {
        const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
        const startDate = saleFilterDates.startDate;
        const endDate = saleFilterDates.endDate;
        const brand = item.brand;
        const size = item.size || 'N/A';

        if (startDate && endDate) {
          if (!(itemDate >= startDate && itemDate <= endDate)) return;
        }

        const key = `${brand}-${size}`;
        if (!saleSizeMap[key]) {
          saleSizeMap[key] = {
            brand,
            size,
            totalItems: 0,
            totalCost: 0,
            dates: new Set(),
          };
        }

        saleSizeMap[key].totalItems += item.quantity;
        saleSizeMap[key].totalCost += item.price * item.quantity;
        if (item.date) saleSizeMap[key].dates.add(item.date.toISOString().split('T')[0]);
      });

    const saleSummary = Object.values(saleSizeMap)
      .map(entry => ({
        brand: entry.brand,
        totalItems: entry.totalItems,
        totalCost: entry.totalCost,
        sizes: entry.size,
        date: Array.from(entry.dates).sort().join(', ') || 'N/A',
      }))
      .filter(entry => {
        const query = saleSearchQuery.toLowerCase();
        return (
          entry.brand.toLowerCase().includes(query) ||
          entry.sizes.toLowerCase().includes(query)
        );
      });

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    return saleSummary.slice(indexOfFirstRow, indexOfLastRow);
  };

  const totalSalePages = (customerName) => {
    const customer = customerSummary.find(item => item.customer === customerName);
    if (!customer) return 1;

    const saleSizeSet = new Set();
    sellData
      .filter(item => (item.customerName || 'N/A') === customerName)
      .forEach(item => {
        const brand = item.brand;
        const size = item.size || 'N/A';
        const key = `${brand}-${size}`;
        const query = saleSearchQuery.toLowerCase();
        if (
          brand.toLowerCase().includes(query) ||
          size.toLowerCase().includes(query)
        ) {
          saleSizeSet.add(key);
        }
      });

    return Math.ceil(saleSizeSet.size / rowsPerPage);
  };

  const getTotalBrands = (customerName) => {
    const customer = customerSummary.find(item => item.customer === customerName);
    return customer ? Object.keys(customer.brands).length : 0;
  };

  const getLedgerForCustomer = (customerName) => {
    const customer = customerSummary.find(item => item.customer === customerName);
    if (!customer) return [];

    const fixedBalance = customer.totalCost || 0;

    const ledgerData = ledgerEntries
      .filter(entry => entry.customerName === customerName)
      .filter(entry => {
        const entryDate = new Date(entry.date);
        const { startDate, endDate } = ledgerFilterDates;
        if (startDate && endDate) {
          return entryDate >= startDate && entryDate <= endDate;
        }
        return true;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(entry => ({
        ...entry,
        balance: fixedBalance.toFixed(2),
      }));

    return ledgerData;
  };

  const openModal = (customer) => {
    setSelectedCustomer(customer);
    setSaleSearchQuery('');
    setCurrentPage(1);
    setSaleFilterDates({ startDate: null, endDate: null });
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setSelectedCustomer(null);
    setModalIsOpen(false);
  };

  const openAddCustomerModal = () => {
    setAddCustomerModalIsOpen(true);
  };

  const closeAddCustomerModal = () => {
    setAddCustomerModalIsOpen(false);
    setCustomerFormData({ customerName: '', totalBrands: 0, totalItems: 0, totalCost: '', totalPaid: '', due: '', paymentMethod: '', bankName: '' });
  };

  const openLedgerModal = (customer) => {
    setSelectedCustomer(customer);
    setLedgerFilterDates({ startDate: null, endDate: null });
    setLedgerModalIsOpen(true);
  };

  const closeLedgerModal = () => {
    setLedgerModalIsOpen(false);
  };

  const handleCustomerFormChange = (e) => {
    const { name, value } = e.target;
    const updatedFormData = { ...customerFormData, [name]: value };

    if (name === 'customerName') {
      updatedFormData.totalBrands = getTotalBrands(value);
      updatedFormData.paymentMethod = '';
      updatedFormData.bankName = '';
      const customerData = customerSummary.find(item => item.customer === value);
      const customerDetailsData = customerDetails.find(detail => detail.customerName === value) || {};
      updatedFormData.totalPaid = customerDetailsData.totalPaid || '';
      updatedFormData.totalItems = customerData ? customerData.totalItems : 0;
      updatedFormData.totalCost = customerData ? customerData.totalCost.toFixed(2) : '';
      updatedFormData.due = customerData ? (customerData.totalCost - (parseFloat(customerDetailsData.totalPaid) || 0)).toFixed(2) : '';
    }

    if (name === 'paymentMethod') {
      updatedFormData.bankName = value === 'Bank' ? updatedFormData.bankName : '';
    }

    if (name === 'totalPaid') {
      const customerData = customerSummary.find(item => item.customer === updatedFormData.customerName);
      const totalCost = customerData?.totalCost || 0;
      const existingTotalPaid = customerDetails.find(detail => detail.customerName === updatedFormData.customerName)?.totalPaid || 0;
      const newPayment = parseFloat(value) || 0;
      updatedFormData.due = (totalCost - (existingTotalPaid + newPayment)).toFixed(2);
    }

    setCustomerFormData(updatedFormData);
  };

  const handleAddCustomerDetails = async (e) => {
    e.preventDefault();
    const { customerName, totalPaid, due, paymentMethod, bankName } = customerFormData;

    if (!customerName || !totalPaid || !paymentMethod) {
      toast.error('Please fill all required fields (Customer Name, Total Paid, Payment Method)');
      return;
    }

    if (paymentMethod === 'Bank' && !bankName) {
      toast.error('Please provide bank name for bank payment');
      return;
    }

    const customerExists = customerDetails.find(detail => detail.customerName === customerName);
    const customerData = customerSummary.find(item => item.customer === customerName);

    if (!customerData) {
      toast.error('Customer not found in sales data');
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const narration = paymentMethod === 'Bank' ? `Payment via ${bankName}` : `Payment via ${paymentMethod}`;

    try {
      if (customerExists) {
        const customerDoc = doc(db, 'customerDetails', customerExists.id);
        const existingTotalPaid = parseFloat(customerExists.totalPaid) || 0;
        const newTotalPaid = existingTotalPaid + (parseFloat(totalPaid) || 0);
        const newDue = (customerData.totalCost - newTotalPaid).toFixed(2);
        await updateDoc(customerDoc, {
          customerName,
          totalPaid: newTotalPaid,
          due: parseFloat(newDue) >= 0 ? parseFloat(newDue) : 0,
          paymentMethod,
          bankName: paymentMethod === 'Bank' ? bankName : '',
          date: todayDate,
          totalItems: customerData.totalItems,
          totalCost: customerData.totalCost,
        });
        await addDoc(collection(db, 'customerLedgerEntries'), {
          customerName,
          invoiceNumber: `RV${Date.now()}`,
          date: todayDate,
          narration,
          debit: paymentMethod === 'Debit Card' ? parseFloat(totalPaid) || 0 : 0,
          credit: paymentMethod === 'Bank' ? parseFloat(totalPaid) || 0 : 0,
        });
        toast.success('Customer details updated successfully');
      } else {
        await addDoc(collection(db, 'customerDetails'), {
          customerName,
          totalPaid: parseFloat(totalPaid),
          due: parseFloat(due),
          paymentMethod,
          bankName: paymentMethod === 'Bank' ? bankName : '',
          date: todayDate,
          totalItems: customerData.totalItems,
          totalCost: customerData.totalCost,
        });
        await addDoc(collection(db, 'customerLedgerEntries'), {
          customerName,
          invoiceNumber: `RV${Date.now()}`,
          date: todayDate,
          narration,
          debit: paymentMethod === 'Debit Card' ? parseFloat(totalPaid) || 0 : 0,
          credit: paymentMethod === 'Bank' ? parseFloat(totalPaid) || 0 : 0,
        });
        toast.success('Customer details added successfully');
      }

      sellData
        .filter(item => (item.customerName || 'N/A') === customerName && item.invoiceNumber)
        .forEach(async (item) => {
          const existingLedgerEntry = ledgerEntries.find(entry => entry.invoiceNumber === item.invoiceNumber);
          if (!existingLedgerEntry) {
            await addDoc(collection(db, 'customerLedgerEntries'), {
              customerName,
              invoiceNumber: item.invoiceNumber,
              date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : item.date,
              narration: item.narration || `${item.size} ${item.brand} Qty_${item.quantity}_Rate_${item.price}`,
              debit: item.price * item.quantity,
              credit: 0,
            });
          }
        });

      closeAddCustomerModal();
    } catch (error) {
      toast.error('Error saving details');
      console.error(error);
    }
  };

  const handlePrint = () => {
    if (!selectedCustomer) {
      toast.error('No customer selected for printing');
      return;
    }

    const ledgerData = getLedgerForCustomer(selectedCustomer.customer);
    const customer = customerSummary.find(item => item.customer === selectedCustomer.customer);

    if (!customer) {
      toast.error('Customer data not found');
      return;
    }

    const fixedBalance = customer.totalCost || 0;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedCustomer.customer} Ledger</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; border: 2px solid #000; border-radius: 10px; }
            h1 { text-align: center; color: #1e40af; font-size: 24px; }
            .header { margin-bottom: 20px; text-align: center; }
            .header p { margin: 5px 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: right; font-size: 14px; }
            th { background-color: #1e40af; color: white; text-align: center; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${selectedCustomer.customer} Ledger</h1>
            <div class="header">
              <p>Sarhad Tyre Traders</p>
              <p>Date: ${new Date().toLocaleString()}</p>
              <p>Total Cost: Rs. ${customer.totalCost.toLocaleString()}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Inv.#</th>
                  <th>Inv. Date</th>
                  <th>Narration</th>
                  <th>Debit Rs.</th>
                  <th>Credit Rs.</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                ${ledgerData.map(entry => {
                  const debit = parseFloat(entry.debit) || 0;
                  const credit = parseFloat(entry.credit) || 0;
                  const date = new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
                  return `
                    <tr>
                      <td>${entry.invoiceNumber || 'N/A'}</td>
                      <td>${date}</td>
                      <td>${entry.narration || 'N/A'}</td>
                      <td>${debit.toLocaleString()}</td>
                      <td>${credit.toLocaleString()}</td>
                      <td>${fixedBalance.toLocaleString()}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            <div class="footer">
              <p>Generated by Sarhad Tyre Traders</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen">
      <h1 className="text-4xl font-extrabold mb-8 text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
        Customer Ledger Dashboard
      </h1>
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-8">
        <input
          type="text"
          placeholder="Search by name, items, cost, paid, due..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-1/3 px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700 transition duration-200"
        />
        <button
          onClick={openAddCustomerModal}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition duration-300"
        >
          Add Customer Details
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((item, index) => (
          <div
            key={index}
            className="bg-white border border-gray-100 p-6 rounded-2xl shadow-lg hover:shadow-xl transition duration-300 cursor-pointer transform hover:-translate-y-1"
            onClick={() => openModal(item)}
          >
            <h2 className="text-xl font-semibold text-gray-800">{item.customer}</h2>
            <p className="text-sm text-gray-500 mt-2">Total Items: {item.totalItems}</p>
            <p className="text-sm text-gray-500">Total Cost: Rs. {item.totalCost.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-4xl mx-auto mt-16 max-h-[70vh] overflow-y-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm"
      >
        {selectedCustomer && (
          <div className="relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 transition duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-3xl font-bold mb-6 text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
              {selectedCustomer.customer} Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Customer Name</p>
                <p className="text-lg font-semibold text-gray-800">{selectedCustomer.customer}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-lg font-semibold text-gray-800">{selectedCustomer.totalItems}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCustomer.totalCost.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Total Paid</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCustomer.totalPaid.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Total Due</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCustomer.due.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => openLedgerModal(selectedCustomer)}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600 transition duration-200"
              >
                View Ledger
              </button>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Sale Details</h3>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <input
                type="text"
                placeholder="Search by brand or size..."
                value={saleSearchQuery}
                onChange={(e) => {
                  setSaleSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-1/3 px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
              />
              <div className="flex gap-3">
                <div className="relative">
                  <DatePicker
                    selected={saleFilterDates.startDate}
                    onChange={(date) => setSaleFilterDates(prev => ({ ...prev, startDate: date }))}
                    selectsStart
                    startDate={saleFilterDates.startDate}
                    endDate={saleFilterDates.endDate}
                    placeholderText="Start Date"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
                <div className="relative">
                  <DatePicker
                    selected={saleFilterDates.endDate}
                    onChange={(date) => setSaleFilterDates(prev => ({ ...prev, endDate: date }))}
                    selectsEnd
                    startDate={saleFilterDates.startDate}
                    endDate={saleFilterDates.endDate}
                    minDate={saleFilterDates.startDate}
                    placeholderText="End Date"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm text-left bg-white rounded-xl shadow-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="py-3 px-6 font-semibold border-1 border-black">Brand</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Sizes</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Total Items</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Total Cost</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Purchase Date</th>
                  </tr>
                </thead>
                <tbody>
                  {getSaleSummary(selectedCustomer.customer).map((sale, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                      <td className="py-3 px-6 border-1">{sale.brand}</td>
                      <td className="py-3 px-6 border-1">{sale.sizes}</td>
                      <td className="py-3 px-6 border-1">{sale.totalItems}</td>
                      <td className="py-3 px-6 border-1">Rs. {sale.totalCost.toLocaleString()}</td>
                      <td className="py-3 px-6 border-1">{sale.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalSalePages(selectedCustomer.customer) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-xl ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition duration-200`}
                >
                  {page}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={closeModal}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={addCustomerModalIsOpen}
        onRequestClose={closeAddCustomerModal}
        className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl mx-auto mt-16 max-h-[70vh] overflow-y-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
      >
        <h2 className="text-2xl font-bold mb-6 text-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
          Add Customer Details
        </h2>
        <form onSubmit={handleAddCustomerDetails} className="flex flex-wrap gap-4">
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Customer Name</label>
            <input
              type="text"
              name="customerName"
              value={customerFormData.customerName}
              onChange={handleCustomerFormChange}
              list="customerNames"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <datalist id="customerNames">
              {customerSummary.map((item, index) => (
                <option key={index} value={item.customer} />
              ))}
            </datalist>
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Brands</label>
            <input
              type="number"
              name="totalBrands"
              value={customerFormData.totalBrands}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Items</label>
            <input
              type="number"
              name="totalItems"
              value={customerFormData.totalItems}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Cost</label>
            <input
              type="number"
              name="totalCost"
              value={customerFormData.totalCost}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Paid</label>
            <input
              type="number"
              name="totalPaid"
              value={customerFormData.totalPaid}
              onChange={handleCustomerFormChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Due</label>
            <input
              type="number"
              name="due"
              value={customerFormData.due}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Payment Method</label>
            <select
              name="paymentMethod"
              value={customerFormData.paymentMethod}
              onChange={handleCustomerFormChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select Payment Method</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Bank">Bank</option>
            </select>
          </div>
          {customerFormData.paymentMethod === 'Bank' && (
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Bank Name</label>
              <input
                type="text"
                name="bankName"
                value={customerFormData.bankName}
                onChange={handleCustomerFormChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          )}
          <div className="w-full flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={closeAddCustomerModal}
              className="px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition duration-200"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={ledgerModalIsOpen}
        onRequestClose={closeLedgerModal}
        className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-5xl mx-auto mt-16 max-h-[80vh] overflow-y-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm"
      >
        {selectedCustomer && (
          <div className="relative">
            <button
              onClick={closeLedgerModal}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 transition duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-3xl font-bold mb-6 text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
              {selectedCustomer.customer} Ledger
            </h2>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-600">Sarhad Tyre Traders</p>
              <p className="text-sm text-gray-500">Date: ${new Date().toLocaleString()}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex gap-3">
                <div className="relative">
                  <DatePicker
                    selected={ledgerFilterDates.startDate}
                    onChange={(date) => setLedgerFilterDates(prev => ({ ...prev, startDate: date }))}
                    selectsStart
                    startDate={ledgerFilterDates.startDate}
                    endDate={ledgerFilterDates.endDate}
                    placeholderText="Start Date"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
                <div className="relative">
                  <DatePicker
                    selected={ledgerFilterDates.endDate}
                    onChange={(date) => setLedgerFilterDates(prev => ({ ...prev, endDate: date }))}
                    selectsEnd
                    startDate={ledgerFilterDates.startDate}
                    endDate={ledgerFilterDates.endDate}
                    minDate={ledgerFilterDates.startDate}
                    placeholderText="End Date"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm text-left bg-white rounded-xl shadow-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="py-3 px-6 font-semibold border-1 border-black">Inv.#</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Inv. Date</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Narration</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Debit Rs.</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Credit Rs.</th>
                    <th className="py-3 px-6 font-semibold border-1 border-black">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {getLedgerForCustomer(selectedCustomer.customer).map((entry, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                      <td className="py-3 px-6 border-1">{entry.invoiceNumber}</td>
                      <td className="py-3 px-6 border-1">{new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</td>
                      <td className="py-3 px-6 border-1">{entry.narration}</td>
                      <td className="py-3 px-6 border-1">{entry.debit.toLocaleString()}</td>
                      <td className="py-3 px-6 border-1">{entry.credit.toLocaleString()}</td>
                      <td className="py-3 px-6 border-1">{entry.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600 transition duration-200"
              >
                Print
              </button>
              <button
                onClick={closeLedgerModal}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default CustomerLedger;