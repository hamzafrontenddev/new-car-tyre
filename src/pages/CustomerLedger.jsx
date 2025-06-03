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

// Helper function to safely parse dates
const parseDateSafely = (date) => {
  if (date instanceof Date) return date;
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date() : parsed; // Fallback to current date if invalid
  }
  return new Date(); // Fallback if date is undefined/null
};

const CustomerLedger = () => {
  const [sellData, setSellData] = useState([]);
  const [customerDetails, setCustomerDetails] = useState([]);
  const [brandDetails, setBrandDetails] = useState([]);
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
    brand: '',
    size: '',
    totalBrands: 0,
    totalItems: 0,
    totalCost: '',
    totalPaid: '',
    due: '',
    brandDue: '',
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

    const unsubscribeBrandDetails = onSnapshot(collection(db, 'brandDetails'), (snapshot) => {
      const brandList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBrandDetails(brandList);
    });

    const unsubscribeLedger = onSnapshot(collection(db, 'customerLedgerEntries'), (snapshot) => {
      const ledgerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLedgerEntries(ledgerList);
    });

    return () => {
      unsubscribeSell();
      unsubscribeCustomerDetails();
      unsubscribeBrandDetails();
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
      const itemDate = parseDateSafely(item.date);
      customerMap[customer].totalItems += item.quantity;
      customerMap[customer].totalCost += item.price * item.quantity;
      if (!customerMap[customer].brands[item.brand]) {
        customerMap[customer].brands[item.brand] = { totalItems: 0, totalCost: 0, sizes: new Set(), dates: new Set() };
      }
      customerMap[customer].brands[item.brand].totalItems += item.quantity;
      customerMap[customer].brands[item.brand].totalCost += item.price * item.quantity;
      if (item.size) customerMap[customer].brands[item.brand].sizes.add(item.size);
      if (item.date) customerMap[customer].brands[item.brand].dates.add(itemDate.toISOString().split('T')[0]);
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

  const filteredCustomers = customerSummary.filter(item =>
    item.customer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSaleSummary = (customerName) => {
    const customer = customerSummary.find(item => item.customer === customerName);
    if (!customer) return [];

    const saleSizeMap = {};

    sellData
      .filter(item => (item.customerName || 'N/A') === customerName)
      .forEach(item => {
        const itemDate = parseDateSafely(item.date);
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
            earliestDate: itemDate, // Track the earliest date for sorting
          };
        }

        saleSizeMap[key].totalItems += item.quantity;
        saleSizeMap[key].totalCost += item.price * item.quantity;
        if (item.date) saleSizeMap[key].dates.add(itemDate.toISOString().split('T')[0]);
        // Update earliest date if current item date is older
        if (itemDate < saleSizeMap[key].earliestDate) {
          saleSizeMap[key].earliestDate = itemDate;
        }
    });

    const saleSummary = Object.values(saleSizeMap)
      .map(entry => {
        const details = brandDetails.find(detail => item.customerName === customerName && detail.brand === entry.brand && detail.size === entry.size) || {};
        const totalCost = entry.totalCost;
        const totalPaid = parseFloat(details.totalPaid) || 0;
        const due = (totalCost - entry.totalCost).toFixed(2);
        return {
          brand: entry.brand,
          totalItems: entry.totalItems,
          totalCost: totalCost.toFixed(2),
          totalPaid,
          due: parseFloat(due) >= 0 ? parseFloat(due) : 0,
          sizes: entry.size,
          date: Array.from(entry.dates).sort((a, b) => parseDateSafely(a) - parseDateSafely(b)).join(', ') || 'N/A', // Sort dates within the string
          earliestDate: entry.earliestDate, // For sorting the entries
        };
      })
      .filter(entry => {
        const query = saleSearchQuery.toLowerCase();
        return (
          entry.brand.toLowerCase().includes(query) ||
          entry.sizes.toLowerCase().includes(query)
        );
      })
      // Sort by earliest date in ascending order (oldest to newest)
      .sort((a, b) => a.earliestDate - b.earliestDate);

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
    if (!customer) return { ledgerData: [], totalDebit: 0, totalCredit: 0 };

    let runningBalance = 0;
    const ledgerData = ledgerEntries
      .filter(entry => entry.customerName === customerName)
      .filter(entry => {
        const entryDate = parseDateSafely(entry.date);
        const { startDate, endDate } = ledgerFilterDates;
        if (startDate && endDate) {
          return entryDate >= startDate && entryDate <= endDate;
        }
        return true;
      })
      // Sort in ascending order (oldest to newest) and calculate running balance
      .sort((a, b) => parseDateSafely(a.date) - parseDateSafely(b.date))
      .map(entry => {
        const debit = parseFloat(entry.debit) || 0;
        const credit = parseFloat(entry.credit) || 0;
        runningBalance += debit - credit;
        return {
          ...entry,
          balance: runningBalance.toFixed(2),
        };
      });

    const totalDebit = ledgerData.reduce((sum, entry) => sum + (parseFloat(entry.debit) || 0), 0);
    const totalCredit = ledgerData.reduce((sum, entry) => sum + (parseFloat(entry.credit) || 0), 0);

    return { ledgerData, totalDebit, totalCredit };
  };

  const getBrandsForCustomer = (customerName) => {
    const customer = customerSummary.find(item => item.customer === customerName);
    return customer ? Object.keys(customer.brands).sort() : [];
  };

  const getSizesForBrand = (customerName, brand) => {
    const customer = customerSummary.find(item => item.customer === customerName);
    return customer && customer.brands[brand] ? Array.from(customer.brands[brand].sizes).sort() : [];
  };

  const getBrandSizeMetrics = (customerName, brand, size) => {
    let totalItems = 0;
    let totalCost = 0;
    sellData
      .filter(item => (item.customerName || 'N/A') === customerName && item.brand === brand && item.size === size)
      .forEach(item => {
        totalItems += item.quantity;
        totalCost += item.price * item.quantity;
      });
    const brandDetail = brandDetails.find(detail => detail.customerName === customerName && detail.brand === brand && detail.size === size) || {};
    const totalPaid = parseFloat(brandDetail.totalPaid) || 0;
    const due = (totalCost - totalPaid).toFixed(2);
    return { totalItems, totalCost: totalCost.toFixed(2), totalPaid };
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
    setCustomerFormData({
      customerName: '',
      brand: '',
      size: '',
      totalBrands: 0,
      totalItems: '',
      totalCost: '',
      totalPaid: '',
      due: '',
      brandDue: '',
      paymentMethod: '',
      bankName: '',
    });
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
      updatedFormData.brand = '';
      updatedFormData.size = '';
      updatedFormData.totalBrands = getTotalBrands(value);
      updatedFormData.totalItems = 0;
      updatedFormData.totalCost = '';
      updatedFormData.totalPaid = '';
      updatedFormData.due = '';
      updatedFormData.brandDue = '';
      updatedFormData.paymentMethod = '';
      updatedFormData.bankName = '';
      const customerData = customerSummary.find(item => item.customer === value);
      const customerDetailsData = customerDetails.find(detail => detail.customerName === value) || {};
      updatedFormData.totalItems = customerData ? customerData.totalItems : 0;
      updatedFormData.totalCost = customerData ? customerData.totalCost.toFixed(2) : '';
      updatedFormData.due = customerData ? (customerData.totalCost - (parseFloat(customerDetailsData.totalPaid) || 0)).toFixed(2) : '';
    }

    if (name === 'brand') {
      updatedFormData.size = '';
      updatedFormData.totalItems = 0;
      updatedFormData.totalCost = '';
      updatedFormData.totalPaid = '';
      updatedFormData.brandDue = '';
    }

    if (name === 'size') {
      const metrics = getBrandSizeMetrics(updatedFormData.customerName, updatedFormData.brand, value);
      updatedFormData.totalItems = metrics.totalItems;
      updatedFormData.totalCost = metrics.totalCost;
      updatedFormData.totalPaid = metrics.totalPaid;
      updatedFormData.brandDue = metrics.due;
    }

    if (name === 'paymentMethod') {
      updatedFormData.bankName = value === 'Bank' ? updatedFormData.bankName : '';
    }

    if (name === 'totalPaid') {
      const metrics = getBrandSizeMetrics(updatedFormData.customerName, updatedFormData.brand, updatedFormData.size);
      const totalCost = parseFloat(metrics.totalCost) || 0;
      const existingTotalPaid = parseFloat(metrics.totalPaid) || 0;
      const newPayment = parseFloat(value) || 0;
      const customerData = customerSummary.find(item => item.customer === updatedFormData.customerName);
      updatedFormData.due = customerData ? (customerData.totalCost - (parseFloat(customerDetails.find(detail => detail.customerName === updatedFormData.customerName)?.totalPaid || 0) + newPayment)).toFixed(2) : '';
      updatedFormData.brandDue = (totalCost - (existingTotalPaid + newPayment)).toFixed(2);
    }

    setCustomerFormData(updatedFormData);
  };

  const handleAddCustomerDetails = async (e) => {
    e.preventDefault();
    const { customerName, brand, size, totalPaid, paymentMethod, bankName } = customerFormData;

    if (!customerName || !brand || !size || !totalPaid || !paymentMethod) {
      toast.error('Please fill all required fields (Customer Name, Brand, Size, Total Paid, Payment Method)');
      return;
    }

    if (paymentMethod === 'Bank' && !bankName) {
      toast.error('Please provide bank name for bank payment');
      return;
    }

    const customerData = customerSummary.find(item => item.customer === customerName);
    const brandDetailExists = brandDetails.find(detail => detail.customerName === customerName && detail.brand === brand && detail.size === size);
    const customerExists = customerDetails.find(detail => detail.customerName === customerName);

    if (!customerData) {
      toast.error('Customer not found in sales data');
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    let narration = '';
    let debit = 0;
    let credit = 0;

    if (paymentMethod === 'Bank') {
      narration = `ONLINE bY ${bankName}`;
      credit = parseFloat(totalPaid) || 0;
    } else if (paymentMethod === 'Debit Card') {
      const latestSale = sellData
        .filter(item => (item.customerName || 'N/A') === customerName && item.brand === brand && item.size === size)
        .sort((a, b) => parseDateSafely(b.date) - parseDateSafely(a.date))[0];
      if (latestSale) {
        narration = `${latestSale.size || 'N/A'} ${latestSale.model || 'N/A'} ${latestSale.brand || 'N/A'} ${latestSale.quantity || 0}X${latestSale.price || 0}`;
      } else {
        narration = 'Debit Payment';
      }
      debit = parseFloat(totalPaid) || 0;
    }

    try {
      if (brandDetailExists) {
        const brandDoc = doc(db, 'brandDetails', brandDetailExists.id);
        const existingTotalPaid = parseFloat(brandDetailExists.totalPaid) || 0;
        const newTotalPaid = existingTotalPaid + (parseFloat(totalPaid) || 0);
        const brandTotalCost = parseFloat(customerFormData.totalCost) || 0;
        const newDue = (brandTotalCost - newTotalPaid).toFixed(2);
        await updateDoc(brandDoc, {
          customerName,
          brand,
          size,
          totalPaid: newTotalPaid,
          due: parseFloat(newDue) >= 0 ? parseFloat(newDue) : 0,
          paymentMethod,
          bankName: paymentMethod === 'Bank' ? bankName : '',
          date: todayDate,
          totalItems: customerFormData.totalItems,
          totalCost: parseFloat(customerFormData.totalCost),
        });
      } else {
        const brandTotalCost = parseFloat(customerFormData.totalCost) || 0;
        const newDue = (brandTotalCost - parseFloat(totalPaid)).toFixed(2);
        await addDoc(collection(db, 'brandDetails'), {
          customerName,
          brand,
          size,
          totalPaid: parseFloat(totalPaid),
          due: parseFloat(newDue) >= 0 ? parseFloat(newDue) : 0,
          paymentMethod,
          bankName: paymentMethod === 'Bank' ? bankName : '',
          date: todayDate,
          totalItems: customerFormData.totalItems,
          totalCost: parseFloat(customerFormData.totalCost),
        });
      }

      let customerTotalPaid = 0;
      brandDetails
        .filter(detail => detail.customerName === customerName)
        .forEach(detail => {
          customerTotalPaid += parseFloat(detail.totalPaid) || 0;
        });
      customerTotalPaid += parseFloat(totalPaid) || 0;

      if (customerExists) {
        const customerDoc = doc(db, 'customerDetails', customerExists.id);
        const customerTotalCost = customerData.totalCost;
        const customerDue = (customerTotalCost - customerTotalPaid).toFixed(2);
        await updateDoc(customerDoc, {
          customerName,
          totalPaid: customerTotalPaid,
          due: parseFloat(customerDue) >= 0 ? parseFloat(customerDue) : 0,
          date: todayDate,
        });
      } else {
        const customerTotalCost = customerData.totalCost;
        const customerDue = (customerTotalCost - customerTotalPaid).toFixed(2);
        await addDoc(collection(db, 'customerDetails'), {
          customerName,
          totalPaid: customerTotalPaid,
          due: parseFloat(customerDue) >= 0 ? parseFloat(customerDue) : 0,
          date: todayDate,
        });
      }

      await addDoc(collection(db, 'customerLedgerEntries'), {
        customerName,
        brand,
        size,
        invoiceNumber: `RV${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: todayDate,
        narration,
        debit,
        credit,
        createdAt: new Date(),
      });

      sellData
        .filter(item => (item.customerName || 'N/A') === customerName && item.invoiceNumber)
        .forEach(async (item) => {
          const existingLedgerEntry = ledgerEntries.find(entry => entry.invoiceNumber === item.invoiceNumber);
          if (!existingLedgerEntry) {
            await addDoc(collection(db, 'customerLedgerEntries'), {
              customerName,
              brand: item.brand,
              size: item.size,
              invoiceNumber: item.invoiceNumber,
              date: parseDateSafely(item.date).toISOString().split('T')[0],
              narration: `${item.size || 'N/A'} ${item.brand || 'N/A'} Qty_${item.quantity}_Rate_${item.price}`,
              debit: item.price * item.quantity,
              credit: 0,
              createdAt: new Date(),
            });
          }
        });

      toast.success('Customer details saved successfully');
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

    const { ledgerData, totalDebit, totalCredit } = getLedgerForCustomer(selectedCustomer.customer);

    if (!ledgerData.length) {
      toast.error('No ledger data available for printing');
      return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedCustomer.customer} Ledger</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; border: 2px solid #000; border-radius: 10px; }
            .header { margin-bottom: 20px; text-align: center; }
            .header .title { font-size: 24px; font-weight: bold; }
            .header .party { font-size: 16px; margin: 5px 0; }
            .header .account { font-size: 14px; margin: 5px 0; }
            .header .date-range { font-size: 14px; margin: 5px 0; }
            .header .date { font-size: 14px; margin: 5px 0; text-align: right; }
            .header .page { font-size: 12px; color: #666; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: right; }
            th { background-color: #000; color: white; text-align: center; }
            td.text-left { text-align: left; }
            .total-row td { font-weight: bold; }
            .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">SARHAD TYRE TRADERS</div>
              <div class="party">Party Name: ${selectedCustomer.customer}</div>
              <div class="account">ACCOUNT LEDGER</div>
              <div class="date-range">Date ${new Date(ledgerFilterDates.startDate || '2024-01-01').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()} - ${new Date(ledgerFilterDates.endDate || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</div>
              <div class="date">Date: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</div>
              <div class="page">Page 1</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Inv. #</th>
                  <th>Inv. Date</th>
                  <th>Narration</th>
                  <th>Debit Rs.</th>
                  <th>Credit Rs.</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                ${ledgerData.map(entry => `
                  <tr>
                    <td>${entry.invoiceNumber || 'N/A'}</td>
                    <td>${parseDateSafely(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</td>
                    <td class="text-left">${entry.narration || 'N/A'}</td>
                    <td>${(parseFloat(entry.debit) || 0).toLocaleString()}</td>
                    <td>${(parseFloat(entry.credit) || 0).toLocaleString()}</td>
                    <td>${parseFloat(entry.balance).toLocaleString()}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="3">Total:</td>
                  <td>${totalDebit.toLocaleString()}</td>
                  <td>${totalCredit.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <p>Generated by SARHAD TYRE TRADERS</p>
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
          placeholder="Search by customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-1/3 px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700 transition duration-200"
        />
        <button
          onClick={openAddCustomerModal}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition duration-300"
        >
          Add Customer Payment Details
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
            <p className="text-sm text-gray-500">Total Paid: Rs. {item.totalPaid.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Due: Rs. {item.due.toLocaleString()}</p>
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
                    <th className="py-3 px-6 font-semibold border border-black">Brand</th>
                    <th className="py-3 px-6 font-semibold border border-black">Sizes</th>
                    <th className="py-3 px-6 font-semibold border border-black">Total Items</th>
                    <th className="py-3 px-6 font-semibold border border-black">Total Cost</th>
                    <th className="py-3 px-6 font-semibold border border-black">Total Paid</th>
                    <th className="py-3 px-6 font-semibold border border-black">Due</th>
                    <th className="py-3 px-6 font-semibold border border-black">Sale Date</th>
                  </tr>
                </thead>
                <tbody>
                  {getSaleSummary(selectedCustomer.customer).map((sale, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                      <td className="py-3 px-6 border border-black">{sale.brand}</td>
                      <td className="py-3 px-6 border border-black">{sale.sizes}</td>
                      <td className="py-3 px-6 border border-black">{sale.totalItems}</td>
                      <td className="py-3 px-6 border border-black">Rs. {parseFloat(sale.totalCost).toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">Rs. {sale.totalPaid.toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">Rs. {sale.due.toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">{sale.date}</td>
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
          Add Customer Payment Details
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
            <label className="block text-sm font-medium mb-1 text-gray-700">Brand</label>
            <input
              type="text"
              name="brand"
              value={customerFormData.brand}
              onChange={handleCustomerFormChange}
              list="brandNames"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <datalist id="brandNames">
              {getBrandsForCustomer(customerFormData.customerName).map((brand, index) => (
                <option key={index} value={brand} />
              ))}
            </datalist>
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Size</label>
            <input
              type="text"
              name="size"
              value={customerFormData.size}
              onChange={handleCustomerFormChange}
              list="sizeNames"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <datalist id="sizeNames">
              {getSizesForBrand(customerFormData.customerName, customerFormData.brand).map((size, index) => (
                <option key={index} value={size} />
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
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Items (Brand)</label>
            <input
              type="number"
              name="totalItems"
              value={customerFormData.totalItems}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Cost (Brand)</label>
            <input
              type="number"
              name="totalCost"
              value={customerFormData.totalCost}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Payment Amount</label>
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
            <label className="block text-sm font-medium mb-1 text-gray-700">Due (Customer)</label>
            <input
              type="number"
              name="due"
              value={customerFormData.due}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Due (Brand)</label>
            <input
              type="number"
              name="brandDue"
              value={customerFormData.brandDue}
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
              <option value="Debit Card">Debit</option>
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
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition duration-300"
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
            <div className="header mb-6">
              <h2 className="text-3xl font-bold text-center text-gray-900">SARHAD TYRE TRADERS</h2>
              <p className="text-md font-bold text-black mt-2">Party Name: {selectedCustomer.customer}</p>
              <div className="flex justify-between mt-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">ACCOUNT LEDGER</p>
                  <p className="text-sm text-gray-500">
                    Date {new Date(ledgerFilterDates.startDate || '2024-01-01').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()} - 
                    {new Date(ledgerFilterDates.endDate || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 text-right">Page 1</p>
                  <p className="text-sm font-medium text-gray-600">
                    Date: {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                  </p>
                </div>
              </div>
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
                    <th className="py-3 px-6 font-semibold border border-black">Inv.#</th>
                    <th className="py-3 px-6 font-semibold border border-black">Inv. Date</th>
                    <th className="py-3 px-6 font-semibold border border-black">Narration</th>
                    <th className="py-3 px-6 font-semibold border border-black">Debit Rs.</th>
                    <th className="py-3 px-6 font-semibold border border-black">Credit Rs.</th>
                    <th className="py-3 px-6 font-semibold border border-black">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {getLedgerForCustomer(selectedCustomer.customer).ledgerData.map((entry, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                      <td className="py-3 px-6 border border-black">{entry.invoiceNumber}</td>
                      <td className="py-3 px-6 border border-black">{parseDateSafely(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</td>
                      <td className="py-3 px-6 border border-black">{entry.narration}</td>
                      <td className="py-3 px-6 border border-black">{(parseFloat(entry.debit) || 0).toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">{(parseFloat(entry.credit) || 0).toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">{parseFloat(entry.balance).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan="3" className="py-3 px-6 border border-black text-right">Total:</td>
                    <td className="py-3 px-6 border border-black">{getLedgerForCustomer(selectedCustomer.customer).totalDebit.toLocaleString()}</td>
                    <td className="py-3 px-6 border border-black">{getLedgerForCustomer(selectedCustomer.customer).totalCredit.toLocaleString()}</td>
                    <td className="py-3 px-6 border border-black"></td>
                  </tr>
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
            <div className="footer mt-4 text-center text-gray-500 text-sm">
              Generated by SARHAD TYRE TRADERS
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