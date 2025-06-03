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

const CompanyLeaders = () => {
  const [buyData, setBuyData] = useState([]);
  const [companyDetails, setCompanyDetails] = useState([]);
  const [brandDetails, setBrandDetails] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [addCompanyModalIsOpen, setAddCompanyModalIsOpen] = useState(false);
  const [ledgerModalIsOpen, setLedgerModalIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(5);
  const [companyFormData, setCompanyFormData] = useState({
    companyName: '',
    brand: '',
    size: '',
    totalBrands: 0,
    totalItems: 0,
    totalCost: '',
    totalCompanyItems: 0,
    totalCompanyCost: '',
    totalPaid: '',
    companyDue: '',
    brandDue: '',
    paymentMethod: '',
    bankName: '',
  });
  const [brandFilterDates, setBrandFilterDates] = useState({
    startDate: null,
    endDate: null,
  });
  const [ledgerFilterDates, setLedgerFilterDates] = useState({
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    const unsubscribeBuy = onSnapshot(collection(db, 'purchasedTyres'), (snapshot) => {
      const buyList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date || Date.now())
      }));
      setBuyData(buyList);
    });

    const unsubscribeCompanyDetails = onSnapshot(collection(db, 'companyDetails'), (snapshot) => {
      const detailsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanyDetails(detailsList);
    });

    const unsubscribeBrandDetails = onSnapshot(collection(db, 'brandDetails'), (snapshot) => {
      const brandList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBrandDetails(brandList);
    });

    const unsubscribeLedger = onSnapshot(collection(db, 'companyLedgerEntries'), (snapshot) => {
      const ledgerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLedgerEntries(ledgerList);
    });

    return () => {
      unsubscribeBuy();
      unsubscribeCompanyDetails();
      unsubscribeBrandDetails();
      unsubscribeLedger();
    };
  }, []);

  const companySummary = useMemo(() => {
    const companyMap = {};

    buyData.forEach(item => {
      if (!companyMap[item.company]) {
        companyMap[item.company] = { totalItems: 0, totalCost: 0, brands: {} };
      }
      const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
      companyMap[item.company].totalItems += item.quantity;
      companyMap[item.company].totalCost += item.price * item.quantity;
      if (!companyMap[item.company].brands[item.brand]) {
        companyMap[item.company].brands[item.brand] = { totalItems: 0, totalCost: 0, sizes: new Set(), dates: new Set() };
      }
      companyMap[item.company].brands[item.brand].totalItems += item.quantity;
      companyMap[item.company].brands[item.brand].totalCost += item.price * item.quantity;
      if (item.size) companyMap[item.company].brands[item.brand].sizes.add(item.size);
      if (item.date) companyMap[item.company].brands[item.brand].dates.add(item.date.toISOString().split('T')[0]);
    });

    return Object.keys(companyMap).map(company => {
      const details = companyDetails.find(detail => detail.companyName === company) || { totalPaid: 0 };
      const totalCost = companyMap[company].totalCost;
      const totalPaid = parseFloat(details.totalPaid) || 0;
      const due = (totalCost - totalPaid).toFixed(2);
      return {
        company,
        totalItems: companyMap[company].totalItems,
        totalCost,
        totalPaid,
        due: parseFloat(due) >= 0 ? parseFloat(due) : 0,
        brands: companyMap[company].brands,
      };
    });
  }, [buyData, companyDetails]);

  const filteredCompanies = companySummary.filter(item =>
    item.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getBrandSummary = (companyName) => {
    const company = companySummary.find(item => item.company === companyName);
    if (!company) return [];

    const brandSizeMap = {};

    buyData
      .filter(item => item.company === companyName)
      .forEach(item => {
        const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
        const startDate = brandFilterDates.startDate;
        const endDate = brandFilterDates.endDate;
        const brand = item.brand;
        const size = item.size || 'N/A';

        if (startDate && endDate) {
          if (!(itemDate >= startDate && itemDate <= endDate)) return;
        }

        const key = `${brand}-${size}`;
        if (!brandSizeMap[key]) {
          brandSizeMap[key] = {
            brand,
            size,
            totalItems: 0,
            totalCost: 0,
            dates: new Set(),
          };
        }

        brandSizeMap[key].totalItems += item.quantity;
        brandSizeMap[key].totalCost += item.price * item.quantity;
        if (item.date) brandSizeMap[key].dates.add(item.date.toISOString().split('T')[0]);
      });

    const brandSummary = Object.values(brandSizeMap)
      .map(entry => {
        const details = brandDetails.find(detail => detail.companyName === companyName && detail.brand === entry.brand && detail.size === entry.size) || {};
        const totalCost = entry.totalCost;
        const totalPaid = parseFloat(details.totalPaid) || 0;
        const due = (totalCost - totalPaid).toFixed(2);
        return {
          brand: entry.brand,
          totalItems: entry.totalItems,
          totalCost: totalCost.toFixed(2),
          totalPaid: totalPaid,
          due: parseFloat(due) >= 0 ? parseFloat(due) : 0,
          totalReturn: parseFloat(details.totalReturn) || 0,
          sizes: entry.size,
          date: Array.from(entry.dates).sort((a, b) => new Date(b) - new Date(a)).join(', ') || 'N/A',
        };
      })
      .filter(entry => {
        const query = brandSearchQuery.toLowerCase();
        return (
          entry.brand.toLowerCase().includes(query) ||
          entry.sizes.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.date.split(',')[0]) - new Date(a.date.split(',')[0]));

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    return brandSummary.slice(indexOfFirstRow, indexOfLastRow);
  };

  const totalBrandPages = (companyName) => {
    const company = companySummary.find(item => item.company === companyName);
    if (!company) return 1;

    const brandSizeSet = new Set();
    buyData
      .filter(item => item.company === companyName)
      .forEach(item => {
        const brand = item.brand;
        const size = item.size || 'N/A';
        const key = `${brand}-${size}`;
        const query = brandSearchQuery.toLowerCase();
        if (
          brand.toLowerCase().includes(query) ||
          size.toLowerCase().includes(query)
        ) {
          brandSizeSet.add(key);
        }
      });

    return Math.ceil(brandSizeSet.size / rowsPerPage);
  };

  const getTotalBrands = (companyName) => {
    const company = companySummary.find(item => item.company === companyName);
    return company ? Object.keys(company.brands).length : 0;
  };

  const getLedgerForCompany = (companyName) => {
    const company = companySummary.find(item => item.company === companyName);
    if (!company) return { ledgerData: [], totalDebit: 0, totalCredit: 0 };

    const sortedEntries = ledgerEntries
      .filter(entry => entry.companyName === companyName)
      .filter(entry => {
        const entryDate = new Date(entry.date);
        const { startDate, endDate } = ledgerFilterDates;
        if (startDate && endDate) {
          return entryDate >= startDate && entryDate <= endDate;
        }
        return true;
      })
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt) : new Date(a.date);
        const bDate = b.createdAt ? new Date(b.createdAt) : new Date(b.date);
        return bDate - aDate; // Descending order: newest to oldest
      });

    let runningBalance = 0; // Start balance from 0
    const ledgerData = sortedEntries.map((entry, index) => {
      const debit = parseFloat(entry.debit) || 0;
      const credit = parseFloat(entry.credit) || 0;
      runningBalance = runningBalance + debit - credit; // Debit increases balance, Credit decreases balance

      let detailedNarration = entry.narration || 'N/A';
      if (entry.narration && entry.narration.startsWith('ONLINE bY')) {
        detailedNarration = entry.narration;
      } else {
        let buyItem = buyData.find(item => item.invoiceNumber === entry.invoiceNumber);
        if (!buyItem) {
          buyItem = buyData
            .filter(item => item.company === companyName && item.brand === entry.brand && item.size === entry.size)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        }
        if (buyItem) {
          detailedNarration = `${buyItem.size || 'N/A'} ${buyItem.model || 'N/A'} ${buyItem.brand || 'N/A'} ${buyItem.quantity || 0}X${buyItem.price || 0}`;
        }
      }

      return {
        index: index + 1,
        invoiceNumber: entry.invoiceNumber || `RV${Date.now()}-${index}`,
        date: entry.date,
        narration: detailedNarration,
        debit,
        credit,
        balance: runningBalance.toFixed(2),
        createdAt: entry.createdAt || entry.date,
        originalEntry: entry,
      };
    });

    const totalDebit = ledgerData.reduce((sum, entry) => sum + (parseFloat(entry.debit) || 0), 0);
    const totalCredit = ledgerData.reduce((sum, entry) => sum + (parseFloat(entry.credit) || 0), 0);

    return { ledgerData, totalDebit, totalCredit };
  };

  const getBrandsForCompany = (companyName) => {
    const company = companySummary.find(item => item.company === companyName);
    return company ? Object.keys(company.brands).sort() : [];
  };

  const getSizesForBrand = (companyName, brand) => {
    const company = companySummary.find(item => item.company === companyName);
    return company && company.brands[brand] ? Array.from(company.brands[brand].sizes).sort() : [];
  };

  const getBrandSizeMetrics = (companyName, brand, size) => {
    let totalItems = 0;
    let totalCost = 0;

    buyData
      .filter(item => item.company === companyName && item.brand === brand && item.size === size)
      .forEach(item => {
        totalItems += item.quantity;
        totalCost += item.price * item.quantity;
      });

    const brandDetail = brandDetails.find(detail => detail.companyName === companyName && detail.brand === brand && detail.size === size) || {};
    const totalPaid = parseFloat(brandDetail.totalPaid) || 0;
    const due = (totalCost - totalPaid).toFixed(2);

    return { totalItems, totalCost: totalCost.toFixed(2), totalPaid, due };
  };

  const getCompanyMetrics = (companyName) => {
    const company = companySummary.find(item => item.company === companyName);
    if (!company) return { totalItems: 0, totalCost: 0, due: 0 };
    return {
      totalItems: company.totalItems,
      totalCost: company.totalCost.toFixed(2),
      due: company.due,
    };
  };

  const openModal = (company) => {
    setSelectedCompany(company);
    setBrandSearchQuery('');
    setCurrentPage(1);
    setBrandFilterDates({ startDate: null, endDate: null });
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setSelectedCompany(null);
    setModalIsOpen(false);
  };

  const openAddCompanyModal = () => {
    setAddCompanyModalIsOpen(true);
  };

  const closeAddCompanyModal = () => {
    setAddCompanyModalIsOpen(false);
    setCompanyFormData({
      companyName: '',
      brand: '',
      size: '',
      totalBrands: 0,
      totalItems: 0,
      totalCost: '',
      totalCompanyItems: 0,
      totalCompanyCost: '',
      totalPaid: '',
      companyDue: '',
      brandDue: '',
      paymentMethod: '',
      bankName: '',
    });
  };

  const openLedgerModal = (company) => {
    setSelectedCompany(company);
    setLedgerFilterDates({ startDate: null, endDate: null });
    setLedgerModalIsOpen(true);
  };

  const closeLedgerModal = () => {
    setLedgerModalIsOpen(false);
  };

  const handleCompanyFormChange = (e) => {
    const { name, value } = e.target;
    const updatedFormData = { ...companyFormData, [name]: value };

    if (name === 'companyName') {
      updatedFormData.brand = '';
      updatedFormData.size = '';
      updatedFormData.totalBrands = getTotalBrands(value);
      updatedFormData.totalItems = 0;
      updatedFormData.totalCost = '';
      updatedFormData.totalCompanyItems = 0;
      updatedFormData.totalCompanyCost = '';
      updatedFormData.totalPaid = '';
      updatedFormData.companyDue = '';
      updatedFormData.brandDue = '';
      updatedFormData.paymentMethod = '';
      updatedFormData.bankName = '';
      const companyMetrics = getCompanyMetrics(value);
      updatedFormData.totalCompanyItems = companyMetrics.totalItems;
      updatedFormData.totalCompanyCost = companyMetrics.totalCost;
      updatedFormData.companyDue = companyMetrics.due;
    }

    if (name === 'brand') {
      updatedFormData.size = '';
      updatedFormData.totalItems = 0;
      updatedFormData.totalCost = '';
      updatedFormData.totalPaid = '';
      updatedFormData.brandDue = '';
    }

    if (name === 'size') {
      const metrics = getBrandSizeMetrics(updatedFormData.companyName, updatedFormData.brand, value);
      updatedFormData.totalItems = metrics.totalItems;
      updatedFormData.totalCost = metrics.totalCost;
      updatedFormData.totalPaid = metrics.totalPaid;
      updatedFormData.brandDue = metrics.due;
    }

    if (name === 'paymentMethod') {
      updatedFormData.bankName = value === 'Bank' ? updatedFormData.bankName : '';
    }

    if (name === 'totalPaid') {
      const metrics = getBrandSizeMetrics(updatedFormData.companyName, updatedFormData.brand, updatedFormData.size);
      const totalCost = parseFloat(metrics.totalCost) || 0;
      const existingTotalPaid = parseFloat(metrics.totalPaid) || 0;
      const newPayment = parseFloat(value) || 0;
      const companyMetrics = getCompanyMetrics(updatedFormData.companyName);
      updatedFormData.companyDue = (companyMetrics.due - newPayment).toFixed(2);
      updatedFormData.brandDue = (totalCost - (existingTotalPaid + newPayment)).toFixed(2);
    }

    setCompanyFormData(updatedFormData);
  };

  const handleAddCompanyDetails = async (e) => {
    e.preventDefault();
    const { companyName, brand, size, totalPaid, paymentMethod, bankName } = companyFormData;

    if (!companyName || !brand || !size || !totalPaid || !paymentMethod) {
      toast.error('Please fill all required fields (Company Name, Brand, Size, Total Paid, Payment Method)');
      return;
    }

    if (paymentMethod === 'Bank' && !bankName) {
      toast.error('Please provide bank name for bank payment');
      return;
    }

    const companyData = companySummary.find(item => item.company === companyName);
    const brandDetailExists = brandDetails.find(detail => detail.companyName === companyName && detail.brand === brand && detail.size === size);
    const companyDetailExists = companyDetails.find(detail => detail.companyName === companyName);

    if (!companyData) {
      toast.error('Company not found in purchase data');
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const createdAt = new Date();
    let narration = '';
    let debit = 0;
    let credit = 0;

    if (paymentMethod === 'Bank') {
      narration = `ONLINE bY ${bankName}`;
      credit = parseFloat(totalPaid) || 0; // Credit payment reduces balance
    } else if (paymentMethod === 'Debit Card') {
      const latestPurchase = buyData
        .filter(item => item.company === companyName && item.brand === brand && item.size === size)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (latestPurchase) {
        narration = `${latestPurchase.size || 'N/A'} ${latestPurchase.model || 'N/A'} ${latestPurchase.brand || 'N/A'} ${latestPurchase.quantity || 0}X${latestPurchase.price || 0}`;
      } else {
        narration = 'Debit Payment';
      }
      debit = parseFloat(totalPaid) || 0; // Debit payment increases balance
    }

    try {
      // Update or add brand-specific details
      if (brandDetailExists) {
        const brandDoc = doc(db, 'brandDetails', brandDetailExists.id);
        const existingTotalPaid = parseFloat(brandDetailExists.totalPaid) || 0;
        const newTotalPaid = existingTotalPaid + (parseFloat(totalPaid) || 0);
        const brandTotalCost = parseFloat(companyFormData.totalCost) || 0;
        const newDue = (brandTotalCost - newTotalPaid).toFixed(2);
        await updateDoc(brandDoc, {
          companyName,
          brand,
          size,
          totalPaid: newTotalPaid,
          due: parseFloat(newDue) >= 0 ? parseFloat(newDue) : 0,
          paymentMethod,
          bankName: paymentMethod === 'Bank' ? bankName : '',
          date: todayDate,
          totalItems: companyFormData.totalItems,
          totalCost: parseFloat(companyFormData.totalCost),
        });
      } else {
        const brandTotalCost = parseFloat(companyFormData.totalCost) || 0;
        const newDue = (brandTotalCost - parseFloat(totalPaid)).toFixed(2);
        await addDoc(collection(db, 'brandDetails'), {
          companyName,
          brand,
          size,
          totalPaid: parseFloat(totalPaid),
          due: parseFloat(newDue) >= 0 ? parseFloat(newDue) : 0,
          paymentMethod,
          bankName: paymentMethod === 'Bank' ? bankName : '',
          date: todayDate,
          totalItems: companyFormData.totalItems,
          totalCost: parseFloat(companyFormData.totalCost),
        });
      }

      // Update company-level totalPaid and due
      let companyTotalPaid = 0;
      brandDetails
        .filter(detail => detail.companyName === companyName)
        .forEach(detail => {
          companyTotalPaid += parseFloat(detail.totalPaid) || 0;
        });
      companyTotalPaid += parseFloat(totalPaid) || 0;

      if (companyDetailExists) {
        const companyDoc = doc(db, 'companyDetails', companyDetailExists.id);
        const companyTotalCost = companySummary.find(item => item.company === companyName)?.totalCost || 0;
        const companyDue = (companyTotalCost - companyTotalPaid).toFixed(2);
        await updateDoc(companyDoc, {
          companyName,
          totalPaid: companyTotalPaid,
          due: parseFloat(companyDue) >= 0 ? parseFloat(companyDue) : 0,
          date: todayDate,
        });
      } else {
        const companyTotalCost = companySummary.find(item => item.company === companyName)?.totalCost || 0;
        const companyDue = (companyTotalCost - companyTotalPaid).toFixed(2);
        await addDoc(collection(db, 'companyDetails'), {
          companyName,
          totalPaid: companyTotalPaid,
          due: parseFloat(companyDue) >= 0 ? parseFloat(companyDue) : 0,
          date: todayDate,
        });
      }

      // Add ledger entry
      await addDoc(collection(db, 'companyLedgerEntries'), {
        companyName,
        brand,
        size,
        invoiceNumber: `RV${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: todayDate,
        narration,
        debit,
        credit,
        createdAt,
      });

      toast.success('Payment details saved successfully');
      closeAddCompanyModal();
    } catch (error) {
      toast.error('Error saving details');
      console.error(error);
    }
  };

  const handlePrint = () => {
    if (!selectedCompany) {
      toast.error('No company selected for printing');
      return;
    }

    const { ledgerData, totalDebit, totalCredit } = getLedgerForCompany(selectedCompany.company);

    if (!ledgerData.length) {
      toast.error('No ledger data available for printing');
      return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedCompany.company} Ledger</title>
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
              <div class="party">Party Name: ${selectedCompany.company}</div>
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
                    <td>${entry.invoiceNumber}</td>
                    <td>${new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</td>
                    <td class="text-left">${entry.narration}</td>
                    <td>${entry.debit.toLocaleString()}</td>
                    <td>${entry.credit.toLocaleString()}</td>
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
        Company Ledger Dashboard
      </h1>
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-8">
        <input
          type="text"
          placeholder="Search by company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-1/3 px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700 transition duration-200"
        />
        <button
          onClick={openAddCompanyModal}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition duration-300"
        >
          Add Brand Payment Details
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map((item, index) => (
          <div
            key={index}
            className="bg-white border border-gray-100 p-6 rounded-2xl shadow-lg hover:shadow-xl transition duration-300 cursor-pointer transform hover:-translate-y-1"
            onClick={() => openModal(item)}
          >
            <h2 className="text-xl font-semibold text-gray-800">{item.company}</h2>
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
        {selectedCompany && (
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
              {selectedCompany.company} Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Company Name</p>
                <p className="text-lg font-semibold text-gray-800">{selectedCompany.company}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-lg font-semibold text-gray-800">{selectedCompany.totalItems}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCompany.totalCost.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Total Paid</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCompany.totalPaid.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-sm font-medium text-gray-600">Total Due</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCompany.due.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => openLedgerModal(selectedCompany)}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600 transition duration-200"
              >
                View Ledger
              </button>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Brand Details</h3>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <input
                type="text"
                placeholder="Search by brand or size..."
                value={brandSearchQuery}
                onChange={(e) => {
                  setBrandSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-1/3 px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
              />
              <div className="flex gap-3">
                <div className="relative">
                  <DatePicker
                    selected={brandFilterDates.startDate}
                    onChange={(date) => setBrandFilterDates(prev => ({ ...prev, startDate: date }))}
                    selectsStart
                    startDate={brandFilterDates.startDate}
                    endDate={brandFilterDates.endDate}
                    placeholderText="Start Date"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
                <div className="relative">
                  <DatePicker
                    selected={brandFilterDates.endDate}
                    onChange={(date) => setBrandFilterDates(prev => ({ ...prev, endDate: date }))}
                    selectsEnd
                    startDate={brandFilterDates.startDate}
                    endDate={brandFilterDates.endDate}
                    minDate={brandFilterDates.startDate}
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
                    <th className="py-3 px-6 font-semibold border border-black">Purchase Date</th>
                  </tr>
                </thead>
                <tbody>
                  {getBrandSummary(selectedCompany.company).map((brand, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                      <td className="py-3 px-6 border border-black">{brand.brand}</td>
                      <td className="py-3 px-6 border border-black">{brand.sizes}</td>
                      <td className="py-3 px-6 border border-black">{brand.totalItems}</td>
                      <td className="py-3 px-6 border border-black">Rs. {brand.totalCost.toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">Rs. {brand.totalPaid.toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">Rs. {brand.due.toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">{brand.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalBrandPages(selectedCompany.company) }, (_, i) => i + 1).map(page => (
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
        isOpen={addCompanyModalIsOpen}
        onRequestClose={closeAddCompanyModal}
        className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl mx-auto mt-16 max-h-[70vh] overflow-y-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
      >
        <h2 className="text-2xl font-bold mb-6 text-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
          Add Brand Payment Details
        </h2>
        <form onSubmit={handleAddCompanyDetails} className="flex flex-wrap gap-4">
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Company Name</label>
            <input
              type="text"
              name="companyName"
              value={companyFormData.companyName}
              onChange={handleCompanyFormChange}
              list="companyNames"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <datalist id="companyNames">
              {companySummary.map((item, index) => (
                <option key={index} value={item.company} />
              ))}
            </datalist>
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Brand</label>
            <input
              type="text"
              name="brand"
              value={companyFormData.brand}
              onChange={handleCompanyFormChange}
              list="brandNames"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <datalist id="brandNames">
              {getBrandsForCompany(companyFormData.companyName).map((brand, index) => (
                <option key={index} value={brand} />
              ))}
            </datalist>
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Size</label>
            <input
              type="text"
              name="size"
              value={companyFormData.size}
              onChange={handleCompanyFormChange}
              list="sizeNames"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <datalist id="sizeNames">
              {getSizesForBrand(companyFormData.companyName, companyFormData.brand).map((size, index) => (
                <option key={index} value={size} />
              ))}
            </datalist>
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Brands</label>
            <input
              type="number"
              name="totalBrands"
              value={companyFormData.totalBrands}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Company Items</label>
            <input
              type="number"
              name="totalCompanyItems"
              value={companyFormData.totalCompanyItems}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Company Cost</label>
            <input
              type="number"
              name="totalCompanyCost"
              value={companyFormData.totalCompanyCost}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Items (Brand)</label>
            <input
              type="number"
              name="totalItems"
              value={companyFormData.totalItems}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Total Cost (Brand)</label>
            <input
              type="number"
              name="totalCost"
              value={companyFormData.totalCost}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Payment Amount</label>
            <input
              type="number"
              name="totalPaid"
              value={companyFormData.totalPaid}
              onChange={handleCompanyFormChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Due (Company)</label>
            <input
              type="number"
              name="companyDue"
              value={companyFormData.companyDue}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Due (Brand)</label>
            <input
              type="number"
              name="brandDue"
              value={companyFormData.brandDue}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-100 rounded-xl"
              readOnly
            />
          </div>
          <div className="w-full md:w-[48%]">
            <label className="block text-sm font-medium mb-1 text-gray-700">Payment Method</label>
            <select
              name="paymentMethod"
              value={companyFormData.paymentMethod}
              onChange={handleCompanyFormChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select Payment Method</option>
              <option value="Debit Card">Debit</option>
              <option value="Bank">Bank</option>
            </select>
          </div>
          {companyFormData.paymentMethod === 'Bank' && (
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Bank Name</label>
              <input
                type="text"
                name="bankName"
                value={companyFormData.bankName}
                onChange={handleCompanyFormChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          )}
          <div className="w-full flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={closeAddCompanyModal}
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
        {selectedCompany && (
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
              <p className="text-md font-bold text-black mt-2">Party Name: ${selectedCompany.company}</p>
              <div className="flex justify-between mt-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">ACCOUNT LEDGER</p>
                  <p className="text-sm text-gray-500">
                    Date ${new Date(ledgerFilterDates.startDate || '2024-01-01').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()} - 
                    ${new Date(ledgerFilterDates.endDate || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 text-right">Page 1</p>
                  <p className="text-sm font-medium text-gray-600">
                    Date: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
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
              <table className="min-w-full border-collapse text-sm bg-white rounded-xl shadow-sm">
                <thead>
                  <tr>
                    <th className="py-3 px-6 font-semibold border border-black">Inv. #</th>
                    <th className="py-3 px-6 font-semibold border border-black">Inv. Date</th>
                    <th className="py-3 px-6 font-semibold border border-black">Narration</th>
                    <th className="py-3 px-6 font-semibold border border-black">Debit Rs.</th>
                    <th className="py-3 px-6 font-semibold border border-black">Credit Rs.</th>
                    <th className="py-3 px-6 font-semibold border border-black">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {getLedgerForCompany(selectedCompany.company).ledgerData.map((entry, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition duration-200">
                      <td className="py-3 px-6 border border-black">{entry.invoiceNumber}</td>
                      <td className="py-3 px-6 border border-black">{new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</td>
                      <td className="py-3 px-6 border border-black text-left">{entry.narration}</td>
                      <td className="py-3 px-6 border border-black">{(parseFloat(entry.debit) || 0).toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">{(parseFloat(entry.credit) || 0).toLocaleString()}</td>
                      <td className="py-3 px-6 border border-black">{parseFloat(entry.balance).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan="3" className="py-3 px-6 border border-black text-right">Total:</td>
                    <td className="py-3 px-6 border border-black">{getLedgerForCompany(selectedCompany.company).totalDebit.toLocaleString()}</td>
                    <td className="py-3 px-6 border border-black">{getLedgerForCompany(selectedCompany.company).totalCredit.toLocaleString()}</td>
                    <td className="py-3 px-6 border border-black"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="footer mt-6 text-center text-gray-600 text-sm">
              <p>Generated by SARHAD TYRE TRADERS</p>
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

export default CompanyLeaders;