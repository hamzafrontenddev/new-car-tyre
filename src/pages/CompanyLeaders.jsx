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
    totalBrands: 0,
    totalCompanyItems: 0,
    totalCompanyCost: '',
    totalPaid: '',
    companyDue: '',
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
  const [companyInfoMap, setCompanyInfoMap] = useState({});
  const [companyUserInfoMap, setCompanyUserInfoMap] = useState({});

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
      // Build info map for quick lookup
      const infoMap = {};
      detailsList.forEach(c => { if (c.companyName) infoMap[c.companyName.toLowerCase()] = c; });
      setCompanyInfoMap(infoMap);
    });

    const unsubscribeBrandDetails = onSnapshot(collection(db, 'brandDetails'), (snapshot) => {
      const brandList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBrandDetails(brandList);
    });

    const unsubscribeLedger = onSnapshot(collection(db, 'companyLedgerEntries'), (snapshot) => {
      const ledgerList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date || Date.now()),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().date || Date.now()),
      }));
      setLedgerEntries(ledgerList);
    });

    // Fetch company users from users collection
    const fetchCompanyUsers = async () => {
      const q = query(collection(db, "users"), where("userType", "==", "Company"));
      const snapshot = await getDocs(q);
      const infoMap = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.name) infoMap[data.name.toLowerCase()] = { mobile: data.mobile, address: data.address };
      });
      setCompanyUserInfoMap(infoMap);
    };
    fetchCompanyUsers();

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
      if (item.date) companyMap[item.company].brands[item.brand].dates.add(itemDate.toISOString().split('T')[0]);
    });

    return Object.keys(companyMap).map(company => {
      const companyLedger = ledgerEntries.filter(entry => entry.companyName.toLowerCase() === company.toLowerCase());
      const totalPaid = companyLedger.reduce((sum, entry) => sum + (parseFloat(entry.credit) || 0), 0);
      const totalCost = companyMap[company].totalCost;
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
  }, [buyData, ledgerEntries]);

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
    .filter(entry => entry.companyName.toLowerCase() === companyName.toLowerCase())
    .filter(entry => {
      const entryDate = new Date(entry.date);
      const { startDate, endDate } = ledgerFilterDates;
      if (startDate && endDate) {
        return entryDate >= startDate && entryDate <= endDate;
      }
      return true;
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let balance = 0;
  const ledgerData = sortedEntries.map((entry, index) => {
    const debit = parseFloat(entry.debit) || 0;
    const credit = parseFloat(entry.credit) || 0;
    balance += debit - credit;

    let description = entry.narration || 'N/A';
    if (description.startsWith('Purchase of') && entry.invoiceNumber) {
      const purchase = buyData.find(p => p.id === entry.invoiceNumber.split('-')[0].replace('INV', ''));
      if (purchase) {
        description = `${purchase.brand || 'N/A'}_${purchase.size || 'N/A'}_Qty_${purchase.quantity}_Rate_${purchase.price}`;
      }
    } else if (!description.includes('Payment via') && !description.includes('_Qty_')) {
      const purchase = buyData.find(p => p.size === description.split('_Qty_')[0] && p.quantity == description.split('_Qty_')[1].split('_Rate_')[0] && p.price == description.split('_Rate_')[1]);
      if (purchase) {
        description = `${purchase.brand || 'N/A'}_${purchase.size || 'N/A'}_Qty_${purchase.quantity}_Rate_${purchase.price}`;
      }
    }

    return {
      index: index + 1,
      date: new Date(entry.date).toISOString().split('T')[0],
      description,
      invoice: entry.invoiceNumber || '-',
      debit,
      credit,
      balance: balance,
      balanceDisplay: balance >= 0 ? balance.toLocaleString() : `-${Math.abs(balance).toLocaleString()}`,
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
      totalBrands: 0,
      totalCompanyItems: 0,
      totalCompanyCost: '',
      totalPaid: '',
      companyDue: '',
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
      updatedFormData.totalBrands = getTotalBrands(value);
      updatedFormData.totalCompanyItems = 0;
      updatedFormData.totalCompanyCost = '';
      updatedFormData.totalPaid = '';
      updatedFormData.companyDue = '';
      updatedFormData.bankName = '';
      const companyMetrics = getCompanyMetrics(value);
      updatedFormData.totalCompanyItems = companyMetrics.totalItems;
      updatedFormData.totalCompanyCost = companyMetrics.totalCost;
      updatedFormData.companyDue = companyMetrics.due;
    }

    if (name === 'paymentMethod') {
      updatedFormData.bankName = value === 'Bank' ? updatedFormData.bankName : '';
    }

    if (name === 'totalPaid') {
      const companyMetrics = getCompanyMetrics(updatedFormData.companyName);
      updatedFormData.companyDue = (companyMetrics.due - (parseFloat(value) || 0)).toFixed(2);
    }

    setCompanyFormData(updatedFormData);
  };

  const handleAddCompanyDetails = async (e) => {
    e.preventDefault();
    const { companyName, totalPaid, paymentMethod, bankName } = companyFormData;

    // Validation logic
    if (!companyName || !totalPaid || !bankName) {
      toast.error('Please fill required fields: Company Name, Payment Amount, and Bank Name');
      return;
    }

    if (paymentMethod === 'Bank' && !bankName) {
      toast.error('Please provide bank name for bank payment');
      return;
    }

    const companyData = companySummary.find(item => item.company === companyName);
    const companyDetailExists = companyDetails.find(detail => detail.companyName === companyName);

    if (!companyData) {
      toast.error('Company not found in purchase data');
      return;
    }

    // Confirmation popup
    const confirmSave = window.confirm('Are you sure you want to save the payment details?');
    if (!confirmSave) {
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const createdAt = new Date();
    const narration = `Payment via ${bankName}`;
    const credit = parseFloat(totalPaid) || 0;

    try {
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

      await addDoc(collection(db, 'companyLedgerEntries'), {
        companyName: companyName.toLowerCase(),
        brand: 'N/A',
        size: 'N/A',
        invoiceNumber: `RV${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: todayDate,
        narration,
        debit: 0,
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
      toast.error('Company not selected for printing');
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
            .header .page { font-size: 12px; color: #666; text-align: right; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 10px 8px; text-align: right; }
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
              <div class="party">
                Party Name: ${selectedCompany.company}
                &nbsp;|&nbsp; Mobile: ${(companyUserInfoMap[selectedCompany.company?.toLowerCase()]?.mobile || 'Not provided')}
                &nbsp;|&nbsp; Address: ${(companyUserInfoMap[selectedCompany.company?.toLowerCase()]?.address || 'Not provided')}
              </div>
              <div class="account">ACCOUNT LEDGER</div>
              <div class="date-range">Date ${new Date(ledgerFilterDates.startDate || '2025-06-01').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()} - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}</div>
              <div class="date">Date: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</div>
              <div class="page">Page 1</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Sr.No</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Debit.Rs</th>
                  <th>Credit.Rs</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                ${ledgerData.map(entry => `
                  <tr>
                    <td class="text-center">${entry.index}</td>
                    <td class="text-center">${entry.date}</td>
                    <td class="text-left">${entry.description}</td>
                    <td class="text-center">${entry.debit > 0 ? ` ${entry.debit.toLocaleString()}` : '0'}</td>
                    <td class="text-center">${entry.credit > 0 ? ` ${entry.credit.toLocaleString()}` : '0'}</td>
                    <td class="text-center" class="${entry.balance >= 0 ? 'balance-cr' : 'balance-dr'}">${entry.balanceDisplay.toLocaleString()}</td>
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
      <h1 className="text-4xl font-semibold mb-8 text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
        Party Ledger Dashboard
      </h1>
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
        <input
          type="text"
          placeholder="Search by company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-1/3 p-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-200"
        />
        <button
          onClick={openAddCompanyModal}
          className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow hover:shadow-lg hover:from-blue-500 hover:to-indigo-500 transition duration-300"
        >
          Add Payment Details
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredCompanies.map((item, index) => (
          <div
            key={index}
            className="bg-white border rounded-xl px-6 py-4 shadow-md hover:shadow-lg transition duration-300 cursor-pointer"
            onClick={() => openModal(item)}
          >
            <h2 className="text-xl font-semibold text-gray-800">{item.company}</h2>
            <p className="text-gray-600">Total Items: {item.totalItems}</p>
            <p className="text-gray-600">Total Cost: Rs. {item.totalCost.toLocaleString()}</p>
            <p className="text-gray-600">Total Paid: Rs. {item.totalPaid.toLocaleString()}</p>
            <p className="text-gray-600">Due: Rs. {item.due.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-4xl mx-auto mt-16 max-h-[70vh] overflow-y-auto"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
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
            <h2 className="text-3xl font-bold mb-6 text-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
              {selectedCompany.company} Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-gray-600 font-medium">Party Name</p>
                <p className="text-lg font-semibold text-gray-800">{selectedCompany.company}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-gray-600 font-medium">Mobile</p>
                <p className="text-lg font-semibold text-gray-800">{companyUserInfoMap[selectedCompany.company?.toLowerCase()]?.mobile || 'Not provided'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-gray-600 font-medium">Address</p>
                <p className="text-lg font-semibold text-gray-800">{companyUserInfoMap[selectedCompany.company?.toLowerCase()]?.address || 'Not provided'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-gray-600">Total Items</p>
                <p className="text-lg font-semibold text-gray-800">{selectedCompany.totalItems}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-gray-600">Total Cost</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCompany.totalCost.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-gray-600">Total Paid</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCompany.totalPaid.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl shadow-sm hover:shadow-md transition duration-200">
                <p className="text-gray-600">Total Due</p>
                <p className="text-lg font-semibold text-gray-800">Rs. {selectedCompany.due.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => openLedgerModal(selectedCompany)}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition duration-200"
              >
                View Ledger
              </button>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Brand Details</h3>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <input
                type="text"
                placeholder="Search by brand or size..."
                value={brandSearchQuery}
                onChange={(e) => {
                  setBrandSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full md:w-1/3 p-4 px-2 border rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                    dateFormat="dd/MM/yyyy"
                    isClearable
                  />
                  <CalendarIcon className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-gray-50">
                    <th className="py-3 px-6 border border-gray-400">Brand</th>
                    <th className="py-3 px-6 border border-gray-400">Size</th>
                    <th className="py-3 px-6 border border-gray-400">Total Items</th>
                    <th className="py-3 px-6 border border-gray-400">Total Cost</th>
                    <th className="py-3 px-6 border border-gray-400">Purchase Date</th>
                  </tr>
                </thead>
                <tbody>
                  {getBrandSummary(selectedCompany.company).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-100">
                      <td className="py-3 px-6 border border-gray-400">{item.brand}</td>
                      <td className="py-3 px-6 border border-gray-400">{item.sizes}</td>
                      <td className="py-3 px-6 border border-gray-400">{item.totalItems}</td>
                      <td className="py-3 px-6 border border-gray-400">Rs. {item.totalCost.toLocaleString()}</td>
                      <td className="py-3 px-6 border border-gray-400">{item.date}</td>
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
                  className={`${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} px-4 py-2 rounded-lg transition duration-200`}
                >
                  {page}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-500 hover:to-pink-500 transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={addCompanyModalIsOpen}
        Ascendancy
        onRequestClose={closeAddCompanyModal}
        className="bg-white p-6 rounded-lg shadow-xl max-w-lg mx-auto w-[90%] max-h-[80vh] overflow-y-auto mt-5"
        overlayClassName="fixed inset-0 bg-gray-900 bg-opacity-50 flex justify-center items-center"
      >
        <div>
          <h2 className="text-2xl font-semibold mb-6 text-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
            Add Payment Details
          </h2>
          <form onSubmit={handleAddCompanyDetails} className="flex flex-wrap gap-4">
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Party Name</label>
              <input
                type="text"
                name="companyName"
                value={companyFormData.companyName}
                onChange={handleCompanyFormChange}
                list="companyNames"
                className="w-full p-2 px-2 border rounded-lg border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <datalist id="companyNames">
                {companySummary.map((item, index) => (
                  <option key={index} value={item.company} />
                ))}
              </datalist>
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Total Brands</label>
              <input
                type="number"
                name="totalBrands"
                value={companyFormData.totalBrands}
                className="w-full px-4 p-2 border rounded-lg border-gray-200 bg-gray-100"
                readOnly
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Total Company Items</label>
              <input
                type="number"
                name="totalCompanyItems"
                value={companyFormData.totalCompanyItems}
                className="w-full px-4 p-2 border rounded-lg border-gray-200 bg-gray-100"
                readOnly
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Total Company Cost</label>
              <input
                type="number"
                name="totalCompanyCost"
                value={companyFormData.totalCompanyCost}
                className="w-full px-4 p-2 border rounded-lg border-gray-200 bg-gray-100"
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
                className="w-full px-4 p-2 border rounded-lg border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Due (Party)</label>
              <input
                type="number"
                name="companyDue"
                value={companyFormData.companyDue}
                className="w-full px-4 p-2 border rounded-lg border-gray-200 bg-gray-100"
                readOnly
              />
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Payment Method</label>
              <select
                name="paymentMethod"
                value={companyFormData.paymentMethod}
                onChange={handleCompanyFormChange}
                className="w-full px-4 p-2 border rounded-lg border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Payment Method</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            <div className="w-full md:w-[48%]">
              <label className="block text-sm font-medium mb-1 text-gray-700">Bank Name</label>
              <input
                type="text"
                name="bankName"
                value={companyFormData.bankName}
                onChange={handleCompanyFormChange}
                className="w-full px-4 p-2 border rounded-lg border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div className="w-full flex justify-end gap-4 mt-6">
              <button
                type="button"
                onClick={closeAddCompanyModal}
                className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition duration-300"
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
              <p className="text-md font-bold text-black mt-2">Party Name: {selectedCompany.company}</p>
              <div className="flex justify-between mt-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">ACCOUNT LEDGER</p>
                  <p className="text-sm text-gray-500">
                    Date {new Date(ledgerFilterDates.startDate || '2025-06-01').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()} - 
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
              <table className="min-w-full border-collapse text-sm bg-white rounded-xl shadow-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="py-3 px-6 font-semibold border border-black text-left">Sr.No</th>
                    <th className="py-3 px-6 font-semibold border border-black text-left">Date</th>
                    <th className="py-3 px-6 font-semibold border border-black text-left">Description</th>
                    <th className="py-3 px-6 font-semibold border border-black text-right">Debit.Rs</th>
                    <th className="py-3 px-6 font-semibold border border-black text-right">Credit.Rs</th>
                    <th className="py-3 px-6 font-semibold border border-black text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {getLedgerForCompany(selectedCompany.company).ledgerData.map((entry, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-3 px-6 border border-black">{entry.index}</td>
                      <td className="py-3 px-6 border border-black">{entry.date}</td>
                      <td className="py-3 px-6 border border-black text-left">{entry.description}</td>
                      <td className="py-3 px-6 border border-black text-right">{entry.debit > 0 ? ` ${entry.debit.toLocaleString()}` : '0'}</td>
                      <td className="py-3 px-6 border border-black text-right">{entry.credit > 0 ? ` ${entry.credit.toLocaleString()}` : '0'}</td>
                      <td className="py-3 px-6 border border-black text-right">
                        {entry.balance >= 0 ? (
                          <span className="text-red-600 font-semibold">{entry.balanceDisplay.toLocaleString()}</span>
                        ) : (
                          <span className="text-green-600 font-semibold">{entry.balanceDisplay.toLocaleString()}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan="3" className="py-3 px-6 border border-black text-right">Total:</td>
                    <td className="py-3 px-6 border border-black text-right">{getLedgerForCompany(selectedCompany.company).totalDebit.toLocaleString()}</td>
                    <td className="py-3 px-6 border border-black text-right">{getLedgerForCompany(selectedCompany.company).totalCredit.toLocaleString()}</td>
                    <td className="py-3 px-6 border border-black text-right"></td>
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