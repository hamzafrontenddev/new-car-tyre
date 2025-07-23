import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
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
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
};

// Helper function to validate and parse numbers
const parseNumber = (value, defaultValue = 0) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const CustomerLedger = () => {
  const [customers, setCustomers] = useState([]);
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [customerUserInfoMap, setCustomerUserInfoMap] = useState({});


  useEffect(() => {
    setIsLoading(true);
    setErrorMessage('');

    // Fetch customers for dropdown and info map
    const fetchCustomers = async () => {
      try {
        const q = query(collection(db, "users"), where("userType", "==", "Customer"));
        const snapshot = await getDocs(q);
        const customerData = snapshot.docs.map(doc => ({
          name: doc.data().name || 'Unknown',
          address: doc.data().address || 'Not provided',
          phone: doc.data().phone || 'Not provided',
        }));
        setCustomers(customerData);
        // Create a map for quick lookup (users collection only)
        const infoMap = {};
        customerData.forEach(c => { 
          infoMap[c.name.trim().toLowerCase()] = { phone: c.phone, address: c.address }; 
        });
        setCustomerUserInfoMap(infoMap);
        if (customerData.length === 0) {
          console.warn('No customers found in users collection.');
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
        toast.error("Failed to load customers");
        setErrorMessage('Failed to load customers. Please check your connection or Firestore rules.');
      }
    };

    fetchCustomers();

    // Fetch soldTyres
    const unsubscribeSell = onSnapshot(collection(db, 'soldTyres'), (snapshot) => {
      const sellList = snapshot.docs.map(doc => {
        const data = doc.data() || {};
        console.log('Raw soldTyres data:', doc.id, data);
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : parseDateSafely(data.date || Date.now()),
          customerName: data.customerName || 'Unknown',
          price: parseNumber(data.price),
          quantity: parseNumber(data.quantity, 1),
          totalPrice: parseNumber(data.payableAmount || (data.price * data.quantity)),
          due: parseNumber(data.due, 0),
        };
      });
      const uniqueSellList = Array.from(new Map(sellList.map(item => [item.id, item])).values());
      setSellData(uniqueSellList);
      console.log('sellData fetched (deduplicated):', uniqueSellList);
      setIsLoading(false);
      if (uniqueSellList.length === 0) {
        setErrorMessage('No sales data found. Please add sales via the Sell page.');
      }
    }, (error) => {
      console.error("Error fetching soldTyres:", error);
      toast.error("Failed to load sales data");
      setErrorMessage('Failed to load sales data. Check Firestore permissions or connectivity.');
      setIsLoading(false);
    });

    // Fetch customerDetails with real-time updates
    const unsubscribeCustomerDetails = onSnapshot(collection(db, 'customerDetails'), (snapshot) => {
      const detailsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        totalPaid: parseNumber(doc.data().totalPaid, 0),
        due: parseNumber(doc.data().due, 0),
      }));
      setCustomerDetails(detailsList);
      console.log('customerDetails fetched:', detailsList);
    }, (error) => {
      console.error("Error fetching customerDetails:", error);
      toast.error("Failed to load customer details");
    });

    // Fetch brandDetails
    const unsubscribeBrandDetails = onSnapshot(collection(db, 'brandDetails'), (snapshot) => {
      const brandList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBrandDetails(brandList);
      console.log('brandDetails fetched:', brandList);
    }, (error) => {
      console.error("Error fetching brandDetails:", error);
    });

    // Fetch customerLedgerEntries
    const unsubscribeLedger = onSnapshot(collection(db, 'customerLedgerEntries'), (snapshot) => {
      const ledgerList = snapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : parseDateSafely(data.date || Date.now()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : parseDateSafely(data.createdAt || Date.now()),
          customerName: data.customerName || 'Unknown',
          debit: parseNumber(data.debit, 0),
          credit: parseNumber(data.credit, 0),
          narration: data.narration || '',
          paymentMethod: data.paymentMethod || '',
          bankName: data.bankName || '',
          description: data.description || '',
        };
      });
      setLedgerEntries(ledgerList);
      console.log('ledgerEntries fetched:', ledgerList);
    }, (error) => {
      console.error("Error fetching customerLedgerEntries:", error);
      toast.error("Failed to load ledger entries");
    });

    return () => {
      unsubscribeSell();
      unsubscribeCustomerDetails();
      unsubscribeBrandDetails();
      unsubscribeLedger();
    };
  }, []);

  const customerSummary = useMemo(() => {
    // Always fresh calculation from sales and payments
    const customerMap = {};

    // 1. Aggregate sales (soldTyres) for totalCost and totalItems
    sellData.forEach(item => {
      const customer = (item.customerName || '').trim().toLowerCase();
      if (!customerMap[customer]) {
        customerMap[customer] = {
          totalItems: 0,
          totalCost: 0,
          totalPaid: 0,
          brands: {},
        };
      }
      const price = parseNumber(item.price, 0);
      const quantity = parseNumber(item.quantity, 1);
      const discount = parseNumber(item.discount, 0);
      const totalPrice = (price - discount) * quantity;
      customerMap[customer].totalItems += quantity;
      customerMap[customer].totalCost += totalPrice;
      // Brands logic (unchanged)
      const brand = item.brand || 'Unknown';
      if (!customerMap[customer].brands[brand]) {
        customerMap[customer].brands[brand] = {
          totalItems: 0,
          totalCost: 0,
          sizes: new Set(),
          dates: new Set(),
        };
      }
      customerMap[customer].brands[brand].totalItems += quantity;
      customerMap[customer].brands[brand].totalCost += totalPrice;
      if (item.size) customerMap[customer].brands[brand].sizes.add(item.size);
      if (item.date) {
        const itemDate = parseDateSafely(item.date);
        customerMap[customer].brands[brand].dates.add(itemDate.toISOString().split('T')[0]);
      }
    });

    // 2. Aggregate payments (customerDetails) for totalPaid
    customerDetails.forEach(detail => {
      const customer = (detail.customerName || '').trim().toLowerCase();
      if (!customerMap[customer]) {
        customerMap[customer] = {
          totalItems: 0,
          totalCost: 0,
          totalPaid: 0,
          brands: {},
        };
      }
      customerMap[customer].totalPaid += parseNumber(detail.totalPaid, 0);
    });

    // 3. Calculate totalDue as totalCost - totalPaid
    return Object.keys(customerMap)
      .filter(customer => customer !== 'unknown')
      .map(customer => ({
        customer: customer.charAt(0).toUpperCase() + customer.slice(1),
        totalItems: customerMap[customer].totalItems,
        totalCost: customerMap[customer].totalCost,
        totalPaid: customerMap[customer].totalPaid,
        totalDue: customerMap[customer].totalCost - customerMap[customer].totalPaid,
        brands: customerMap[customer].brands,
      }));
  }, [sellData, customerDetails]);

  const filteredCustomers = customerSummary.filter(item =>
    item.customer.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  console.log('Filtered customers:', filteredCustomers);

  const getSaleSummary = (customerName) => {
    const customer = customerSummary.find(item => item.customer.toLowerCase() === customerName.toLowerCase());
    if (!customer) return [];

    const saleSizeMap = {};

    sellData
      .filter(item => (item.customerName || '').trim().toLowerCase() === customerName.toLowerCase())
      .forEach(item => {
        const itemDate = parseDateSafely(item.date);
        const startDate = saleFilterDates.startDate;
        const endDate = saleFilterDates.endDate;
        const brand = item.brand || 'Unknown';
        const size = item.size || 'N/A';

        if (startDate && endDate && !(itemDate >= startDate && itemDate <= endDate)) {
          return;
        }

        const totalPrice = parseNumber(item.totalPrice) || parseNumber(item.price) * parseNumber(item.quantity, 1);
        const quantity = parseNumber(item.quantity, 1);
        const due = parseNumber(item.due);
        const paid = totalPrice - due;

        console.log(`Sale summary for ${customerName}: brand=${brand}, size=${size}, totalPrice=${totalPrice}`);

        const key = `${brand}-${size}`;
        if (!saleSizeMap[key]) {
          saleSizeMap[key] = {
            brand,
            size,
            totalItems: 0,
            totalCost: 0,
            totalPaid: 0,
            totalDue: 0,
            dates: new Set(),
            earliestDate: itemDate,
          };
        }

        saleSizeMap[key].totalItems += quantity;
        saleSizeMap[key].totalCost += totalPrice;
        saleSizeMap[key].totalPaid += paid;
        saleSizeMap[key].totalDue += due;
        if (item.date) saleSizeMap[key].dates.add(itemDate.toISOString().split('T')[0]);
        if (itemDate < saleSizeMap[key].earliestDate) {
          saleSizeMap[key].earliestDate = itemDate;
        }
      });

    const saleSummary = Object.values(saleSizeMap)
      .map(entry => ({
        brand: entry.brand,
        totalItems: entry.totalItems,
        totalCost: entry.totalCost.toFixed(2),
        totalPaid: entry.totalPaid.toFixed(2),
        totalDue: entry.totalDue.toFixed(2),
        sizes: entry.size,
        date: Array.from(entry.dates).sort().join(', ') || 'N/A',
        earliestDate: entry.earliestDate,
      }))
      .filter(entry => {
        const query = saleSearchQuery.toLowerCase();
        return (
          entry.brand.toLowerCase().includes(query) ||
          entry.sizes.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.earliestDate - b.earliestDate);

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    return saleSummary.slice(indexOfFirstRow, indexOfLastRow);
  };

  const totalSalePages = (customerName) => {
    const customer = customerSummary.find(item => item.customer.toLowerCase() === customerName.toLowerCase());
    if (!customer) return 1;

    const saleSizeSet = new Set();
    sellData
      .filter(item => (item.customerName || '').trim().toLowerCase() === customerName.toLowerCase())
      .forEach(item => {
        const brand = item.brand || 'Unknown';
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
    const customer = customerSummary.find(item => item.customer.toLowerCase() === customerName.toLowerCase());
    return customer ? Object.keys(customer.brands).length : 0;
  };

  const getLedgerForCustomer = (customerName) => {
    console.log('Fetching ledger for customer:', customerName);
    const customer = customerSummary.find(item => item.customer.toLowerCase() === customerName.toLowerCase());
    if (!customer) {
      console.warn('Customer not found in customerSummary:', customerName);
      return { ledgerData: [], totalDebit: 0, totalCredit: 0 };
    }

    let balance = 0;
    const sortedEntries = ledgerEntries
      .filter(entry => {
        const entryCustomer = (entry.customerName || '').trim().toLowerCase();
        return entryCustomer === customerName.toLowerCase();
      })
      .filter(entry => {
        const entryDate = parseDateSafely(entry.date);
        const { startDate, endDate } = ledgerFilterDates;
        return startDate && endDate ? (entryDate >= startDate && entryDate <= endDate) : true;
      })
      .sort((a, b) => parseDateSafely(a.createdAt) - parseDateSafely(b.createdAt))
      .map((entry, index) => {
        if (!entry) {
          console.warn('Invalid entry skipped:', entry);
          return null;
        }
        const debit = parseNumber(entry.debit);
        const credit = parseNumber(entry.credit);
        balance += debit - credit;

        let description = 'Unknown';
        if (debit > 0) {
          if (entry.narration?.startsWith('Sale_')) {
            const transactionId = entry.narration.replace('Sale_', '');
            const sales = sellData.filter(sale => sale.transactionId === transactionId);
            description = sales.length > 0 ? sales.map(sale => {
              const size = sale.size || 'N/A';
              const brand = sale.brand || 'Unknown';
              const quantity = parseNumber(sale.quantity, 1);
              const price = parseNumber(sale.price);
              return `${size}_${brand}_Qty_${quantity}_Rate_${price}`;
            }).join(', ') : 'Sale (Details Not Found)';
          } else {
            description = entry.description || entry.narration || 'Manual Debit';
          }
        } else if (credit > 0) {
          description = entry.paymentMethod === 'Bank' ? `Payment via ${entry.bankName || 'N/A'}` : 'Cash Payment';
        }

        return {
          index: index + 1,
          date: parseDateSafely(entry.date).toISOString().split('T')[0] || 'N/A',
          description: description || 'N/A',
          debit: debit || 0,
          credit: credit || 0,
          balance: balance,
          balanceDisplay: balance.toLocaleString(),
        };
      })
      .filter(entry => entry !== null);

    const totalDebit = sortedEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = sortedEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    console.log('Ledger data for', customerName, ':', sortedEntries);

    return { ledgerData: sortedEntries, totalDebit, totalCredit };
  };

  const getBrandsForCustomer = (customerName) => {
    const customer = customerSummary.find(item => item.customer.toLowerCase() === customerName.toLowerCase());
    return customer ? Object.keys(customer.brands).sort() : [];
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
      totalBrands: 0,
      totalItems: 0,
      totalCost: '',
      totalPaid: '',
      due: '',
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
      console.log('Customer selected:', value);
      const customerData = customerSummary.find(item => item.customer.toLowerCase() === value.trim().toLowerCase());
      console.log('Matching customer in customerSummary:', customerData);
      updatedFormData.totalBrands = customerData ? getTotalBrands(value) : 0;
      updatedFormData.totalItems = customerData ? customerData.totalItems : 0;
      updatedFormData.totalCost = customerData ? customerData.totalCost.toFixed(2) : '';
      updatedFormData.totalPaid = ''; // Reset to allow new payment input
      updatedFormData.due = customerData ? customerData.totalDue.toFixed(2) : '';
      updatedFormData.paymentMethod = '';
      updatedFormData.bankName = '';
    }

    if (name === 'paymentMethod') {
      updatedFormData.bankName = value === 'Bank' ? updatedFormData.bankName : '';
    }

    if (name === 'totalPaid') {
      const customerData = customerSummary.find(item => item.customer.toLowerCase() === updatedFormData.customerName.trim().toLowerCase());
      const newPayment = parseNumber(value);
      updatedFormData.due = customerData ? (customerData.totalDue - newPayment).toFixed(2) : '';
    }

    setCustomerFormData(updatedFormData);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const { customerName, totalPaid, paymentMethod, bankName } = customerFormData;

    if (!customerName || !totalPaid || !paymentMethod) {
      toast.error('Please fill all required fields (Customer Name, Amount, Payment Method)');
      return;
    }

    if (paymentMethod === 'Bank' && !bankName) {
      toast.error('Please provide bank name for bank payment');
      return;
    }

    const customerData = customerSummary.find(item => item.customer.toLowerCase() === customerName.trim().toLowerCase());
    if (!customerData) {
      toast.error('Customer not found in sales data');
      return;
    }

    const confirmSave = window.confirm(`Are you sure you want to save a payment of Rs. ${totalPaid} for ${customerName}?`);
    if (!confirmSave) {
      toast.info('Payment cancelled');
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const createdAt = new Date();
    const description = paymentMethod === 'Bank' ? `Payment via ${bankName}` : 'Cash Payment';
    const credit = parseNumber(totalPaid);

    try {
      const customerExists = customerDetails.find(detail => detail.customerName.toLowerCase() === customerName.trim().toLowerCase());
      let customerTotalPaid = (customerExists ? parseNumber(customerExists.totalPaid) : 0) + credit;
      const totalCost = parseNumber(customerData?.totalCost, 0);
      let customerTotalDue = totalCost - customerTotalPaid;


      if (customerExists) {
        const customerDoc = doc(db, 'customerDetails', customerExists.id);
        await updateDoc(customerDoc, {
          customerName: customerName.trim(),
          totalPaid: customerTotalPaid,
          due: customerTotalDue >= 0 ? customerTotalDue : 0,
          date: todayDate,
        });
      } else {
        await addDoc(collection(db, 'customerDetails'), {
          customerName: customerName.trim(),
          totalPaid: customerTotalPaid,
          due: customerTotalDue >= 0 ? customerTotalDue : 0,
          date: todayDate,
        });
      }

      await addDoc(collection(db, 'customerLedgerEntries'), {
        customerName: customerName.trim().toLowerCase(),
        date: todayDate,
        description,
        debit: 0,
        credit,
        paymentMethod,
        bankName: paymentMethod === 'Bank' ? bankName : '',
        createdAt,
      });

      toast.success('Customer payment saved successfully');
      closeAddCustomerModal();
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error('Error saving payment');
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

    const safeLedgerData = ledgerData.map(entry => ({
      index: entry.index || 1,
      date: entry.date || 'N/A',
      description: entry.description || 'N/A',
      debit: entry.debit || 0,
      credit: entry.credit || 0,
      balance: entry.balance || 0,
      balanceDisplay: entry.balanceDisplay,
    }));

    const printContent = `
      <html>
        <head>
          <title>${selectedCustomer.customer} Ledger</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; border: 2px solid #000; border-radius: 10px; }
            .header { margin-bottom: 20px; text-align: center; }
            .header .title { font-size: 24px; font-weight: bold; }
            .header .info-row { font-size: 16px; margin: 5px 0; display: flex; justify-content: center; gap: 40px; }
            .header .account { font-size: 14px; margin: 5px 0; }
            .header .date-range { font-size: 14px; margin: 5px 0; }
            .header .date { font-size: 14px; margin: 5px 0; text-align: right; }
            .header .page { font-size: 12px; color: #666; text-align: right; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 10px 8px; text-align: right; }
            th { background-color: #000; color: white; text-align: center; }
            td.text-left { text-align: left; }
            .total-row td { font-weight: bold; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              * { transition: none !important; animation: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">SARHAD TYRE TRADERS</div>
              <div class="info-row">
                <span>Customer Name: ${selectedCustomer.customer || 'Unknown'}</span>
              </div>
              <div class="account">ACCOUNT LEDGER</div>
              <div class="date-range">Date ${new Date(ledgerFilterDates.startDate || '2024-01-01').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()} - ${new Date(ledgerFilterDates.endDate || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</div>
              <div class="date">Date: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</div>
              <div class="page">Page 1</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                ${safeLedgerData.map(entry => `
                  ${entry.debit > 0 ? `
                    <tr>
                      <td>${entry.index}</td>
                      <td>${entry.date}</td>
                      <td class="text-left">${entry.description}</td>
                      <td>${entry.debit.toLocaleString()}</td>
                      <td>0</td>
                      <td class="${entry.balance < 0 ? 'balance-negative' : 'balance-positive'}">${entry.balanceDisplay}</td>
                    </tr>
                  ` : ''}
                  ${entry.credit > 0 ? `
                    <tr>
                      <td>${entry.index}</td>
                      <td>${entry.date}</td>
                      <td class="text-left">${entry.description}</td>
                      <td>0</td>
                      <td>${entry.credit.toLocaleString()}</td>
                      <td class="${entry.balance < 0 ? 'balance-negative' : 'balance-positive'}">${entry.balanceDisplay}</td>
                    </tr>
                  ` : ''}
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
              try {
                window.print();
                window.onafterprint = () => window.close();
              } catch (e) {
                console.error('Print error:', e);
              }
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      toast.error('Failed to open print window. Please check popup blockers.');
    }
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
          className="w-full sm:w-1/3 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition duration-200"
        />
        <button
          onClick={openAddCustomerModal}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition duration-300"
        >
          Add Customer Payment
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-600 mt-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-lg">Loading customer data...</p>
        </div>
      ) : errorMessage || filteredCustomers.length === 0 ? (
        <div className="text-center text-gray-600 mt-8 bg-white p-6 rounded-xl shadow-sm">
          <p className="text-lg font-semibold mb-2">{errorMessage || 'No customers found.'}</p>
          <p className="text-sm">
            {errorMessage
              ? 'Please check your Firestore setup or contact support.'
              : 'Add sales data via the Sell page or ensure customers exist in the system.'}
          </p>
          {customers.length > 0 && !sellData.length && (
            <p className="text-sm mt-2">Customers available: {customers.map(c => c.name).join(', ')}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((item, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 p-6 rounded-xl shadow-md hover:shadow-lg transition duration-300 cursor-pointer transform hover:-translate-y-1"
              onClick={() => openModal(item)}
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{item.customer}</h2>
              <p className="text-sm text-gray-600">Total Items: {item.totalItems}</p>
              <p className="text-sm text-gray-600">Total Cost: Rs. {item.totalCost.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total Paid: Rs. {item.totalPaid.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Due: Rs. {item.totalDue.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-4xl mx-auto mt-16 max-h-[70vh] overflow-y-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center backdrop-blur-sm"
      >
        {selectedCustomer && (
          <div className="relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-200 rounded-full transition duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-3xl font-semibold mb-6 text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
              {selectedCustomer.customer} Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm">
                <p className="text-sm font-medium mb-1 text-gray-600">Customer Name</p>
                <p className="text-lg font-semibold text-gray-800">{selectedCustomer.customer}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm">
                <p className="text-sm font-medium mb-1 text-gray-600">Total Items</p>
                <p className="text-lg font-semibold text-gray-800">{selectedCustomer.totalItems}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm">
                <p className="text-sm font-medium mb-1 text-gray-600">Total Cost</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCustomer.totalCost.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm">
                <p className="text-sm font-medium mb-1 text-gray-600">Total Paid</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCustomer.totalPaid.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm">
                <p className="text-sm font-medium mb-1 text-gray-600">Total Due</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCustomer.totalDue.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => openLedgerModal(selectedCustomer)}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600 transition duration-300"
              >
                View Ledger
              </button>
            </div>
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Sale Details</h3>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div>
                <input
                  type="text"
                  placeholder="Search by brand or size..."
                  value={saleSearchQuery}
                  onChange={(e) => {
                    setSaleSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-1/3 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                />
              </div>
              <div className="flex gap-3">
                <div className="relative w-full">
                  <DatePicker
                    selected={saleFilterDates.startDate}
                    onChange={(date) => setSaleFilterDates(prev => ({ ...prev, startDate: date }))}
                    selectsStart
                    startDate={saleFilterDates.startDate}
                    endDate={saleFilterDates.endDate}
                    placeholderText="Start Date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
                <div className="relative w-full">
                  <DatePicker
                    selected={saleFilterDates.endDate}
                    onChange={(date) => setSaleFilterDates(prev => ({ ...prev, endDate: date }))}
                    selectsEnd
                    startDate={saleFilterDates.startDate}
                    endDate={saleFilterDates.endDate}
                    minDate={saleFilterDates.startDate}
                    placeholderText="End Date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-200 text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="py-3 px-4 text-sm font-semibold">Brand</th>
                    <th className="py-3 px-4 text-sm font-semibold">Sizes</th>
                    <th className="py-3 px-4 text-sm font-semibold">Total Items</th>
                    <th className="py-3 px-4 text-sm font-semibold">Total Cost</th>
                    <th className="py-3 px-4 text-sm font-semibold">Sale Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {getSaleSummary(selectedCustomer.customer).map((sale, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50 transition duration-200">
                      <td className="py-3 px-4 text-center">{sale.brand}</td>
                      <td className="py-3 px-4 text-center">{sale.sizes}</td>
                      <td className="py-3 px-4 text-center">{sale.totalItems}</td>
                      <td className="py-3 px-4 text-center">Rs. {parseFloat(sale.totalCost).toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">{sale.date}</td>
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
                  className={`px-4 py-2 rounded-full ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} transition duration-200`}
                >
                  {page}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={closeModal}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition duration-300"
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
        className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl mx-auto mt-16 max-h-[70vh] overflow-y-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
      >
        <div>
          <h2 className="text-2xl font-bold mb-6 text-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text ">
            Add Customer Payment
          </h2>
          <form onSubmit={handleAddPayment} className="flex flex-wrap gap-4">
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-semibold mb-1 text-gray-700">Customer Name</label>
              <select
                name="customerName"
                value={customerFormData.customerName}
                onChange={handleCustomerFormChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                required
              >
                <option value="">Select Customer</option>
                {customers.map((customer, index) => (
                  <option key={index} value={customer.name}>{customer.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-semibold mb-1 text-gray-700">Total Brands</label>
              <input
                type="number"
                name="totalBrands"
                value={customerFormData.totalBrands}
                className="w-full px-4 py-2 border border-gray-300 bg-gray-100 rounded-lg text-gray-800"
                readOnly
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-semibold mb-1 text-gray-700">Total Items</label>
              <input
                type="number"
                name="totalItems"
                value={customerFormData.totalItems}
                className="w-full px-4 py-2 border border-gray-300 bg-gray-100 rounded-lg text-gray-800"
                readOnly
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-semibold mb-1 text-gray-700">Total Cost</label>
              <input
                type="number"
                name="totalCost"
                value={customerFormData.totalCost}
                className="w-full px-4 py-2 border border-gray-300 bg-gray-100 rounded-lg text-gray-800"
                readOnly
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-semibold mb-1 text-gray-700">Payment Amount</label>
              <input
                type="number"
                name="totalPaid"
                value={customerFormData.totalPaid}
                onChange={handleCustomerFormChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                required
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-semibold mb-1 text-gray-700">Due</label>
              <input
                type="number"
                name="due"
                value={customerFormData.due}
                className="w-full px-4 py-2 border border-gray-300 bg-gray-100 rounded-lg text-gray-800"
                readOnly
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-semibold mb-1 text-gray-700">Payment Method</label>
              <select
                name="paymentMethod"
                value={customerFormData.paymentMethod}
                onChange={handleCustomerFormChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                required
              >
                <option value="">Select Payment Method</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            {customerFormData.paymentMethod === 'Bank' && (
              <div className="w-full md:w-[48%]">
                <label className="block text-sm font-semibold mb-1 text-gray-700">Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  value={customerFormData.bankName}
                  onChange={handleCustomerFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                  required
                />
              </div>
            )}
            <div className="w-full flex justify-end gap-4 mt-6">
              <button
                type="button"
                onClick={closeAddCustomerModal}
                className="px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition duration-200"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal
        isOpen={ledgerModalIsOpen}
        onRequestClose={closeLedgerModal}
        className="bg-white p-6 rounded-xl shadow-lg w-full max-w-5xl mx-auto mt-16 max-h-[80vh] overflow-y-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm"
      >
        {selectedCustomer && (
          <div className="relative">
            <button
              onClick={closeLedgerModal}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-200 rounded-full transition duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="header mb-6">
              <h2 className="text-3xl font-bold text-center text-gray-800">SARHAD TYRE TRADERS</h2>
              <p className="text-center text-lg font-semibold text-gray-600 mt-2">Customer Name: {selectedCustomer.customer}</p>
              <div className="flex justify-between items-center mt-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">ACCOUNT LEDGER</p>
                  <p className="text-sm text-gray-500">
                    Date ${new Date(ledgerFilterDates.startDate || '2023-01-01').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()} - ${new Date(ledgerFilterDates.endDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 text-right">
                    Date: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
                  </p>
                  <p className="text-sm font-semibold text-gray-600 text-right">Page 1</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex gap-3">
                <div className="relative w-full">
                  <DatePicker
                    selected={ledgerFilterDates.startDate}
                    onChange={(date) => setLedgerFilterDates(prev => ({ ...prev, startDate: date }))}
                    selectsStart
                    startDate={ledgerFilterDates.startDate}
                    endDate={ledgerFilterDates.endDate}
                    placeholderText="Start Date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-gray-800"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
                <div className="relative w-full">
                  <DatePicker
                    selected={ledgerFilterDates.endDate}
                    onChange={(date) => setLedgerFilterDates(prev => ({ ...prev, endDate: date }))}
                    selectsEnd
                    startDate={ledgerFilterDates.startDate}
                    endDate={ledgerFilterDates.endDate}
                    minDate={ledgerFilterDates.startDate}
                    placeholderText="End Date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-gray-800"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm bg-white rounded-lg shadow-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="py-3 px-4 text-sm border font-semibold">Sr No</th>
                    <th className="py-3 px-4 text-sm border font-semibold">Date</th>
                    <th className="py-3 px-4 text-sm border font-semibold">Description</th>
                    <th className="py-3 px-4 text-sm border font-semibold">Debit</th>
                    <th className="py-3 px-4 text-sm border font-semibold">Credit</th>
                    <th className="py-3 px-4 text-sm border font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {getLedgerForCustomer(selectedCustomer.customer).ledgerData.map((entry, index) => (
                    <React.Fragment key={index}>
                      {entry.debit > 0 && (
                        <tr key={`debit-${entry.id || index}`} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200`}>
                          <td className="border py-2 px-3 text-center">{entry.index}</td>
                          <td className="border py-2 px-3 text-center">{entry.date}</td>
                          <td className="border py-2 px-3 text-left">{entry.description}</td>
                          <td className="border py-2 px-3 text-right">{entry.debit.toLocaleString()}</td>
                          <td className="border py-2 px-3 text-right">0</td>
                          <td className="border py-2 px-3 text-right">{entry.balanceDisplay.toLocaleString()}</td>
                        </tr>
                      )}
                      {entry.credit > 0 && (
                        <tr key={`credit-${entry.id || index}`} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200`}>
                          <td className="border py-2 px-3 text-center">{entry.index}</td>
                          <td className="border py-2 px-3 text-center">{entry.date}</td>
                          <td className="border py-2 px-3 text-left">{entry.description}</td>
                          <td className="border py-2 px-3 text-right">0</td>
                          <td className="border py-2 px-3 text-right">{entry.credit.toLocaleString()}</td>
                          <td className="border py-2 px-3 text-right">{entry.balanceDisplay.toLocaleString()}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  <tr className="border bg-white font-semibold border-t-2 border-gray-300">
                    <td colSpan="3" className="border py-3 px-4 text-right">Total:</td>
                    <td className="border py-3 px-4 text-right">{getLedgerForCustomer(selectedCustomer.customer).totalDebit.toLocaleString()}</td>
                    <td className="border py-3 px-4 text-right">{getLedgerForCustomer(selectedCustomer.customer).totalCredit.toLocaleString()}</td>
                    <td className="border py-3 px-4 text-right"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="footer mt-6 text-center text-gray-500 text-sm">
              <p>Generated by SARHAD TYRE TRADERS</p>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition duration-300"
              >
                Print
              </button>
              <button
                onClick={closeLedgerModal}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition duration-300"
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