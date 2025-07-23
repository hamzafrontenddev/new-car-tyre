import React, { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-toastify";

const AddUser = () => {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [userType, setUserType] = useState("");
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch users from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort by name for consistent display
      data.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(data);
    });
    return () => unsub();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !mobile || !address || !userType) {
      toast.error("Please fill all fields");
      return;
    }
    const nameToStore =
      userType === "Company"
        ? name.replace(/\s/g, "").toLowerCase()
        : name.toLowerCase();
    const user = { 
      name: nameToStore, 
      mobile: mobile.toLowerCase(), 
      address: address.toLowerCase(), 
      userType 
    };
    const todayDate = new Date().toISOString().split('T')[0];
    try {
      if (editId) {
        const userRef = doc(db, "users", editId);
        await updateDoc(userRef, user);
        toast.success("User updated successfully!");
        setEditId(null);
      } else {
        // Add user to users collection
        await addDoc(collection(db, "users"), user);
        toast.success("User added successfully!");

        // Add to companyDetails or customerDetails based on userType
        const ledgerData = {
          [userType === "Company" ? "companyName" : "customerName"]: nameToStore,
          totalPaid: 0,
          due: 0,
          totalItems: 0,
          totalCost: 0,
          date: todayDate,
        };
        try {
          if (userType === "Company") {
            await addDoc(collection(db, "companyDetails"), ledgerData);
            toast.success("Company added to company ledger!");
          } else if (userType === "Customer") {
            await addDoc(collection(db, "customerDetails"), ledgerData);
            toast.success("Customer added to customer ledger!");
          }
        } catch (err) {
          toast.error(`Error adding to ${userType.toLowerCase()} ledger.`);
          console.error(err);
        }
      }
      setName("");
      setMobile("");
      setAddress("");
      setUserType("");
    } catch (err) {
      toast.error("Error adding/updating user.");
      console.error(err);
    }
  };

  // Handle edit
  const handleEdit = (user) => {
    setName(user.name);
    setMobile(user.mobile);
    setAddress(user.address);
    setUserType(user.userType);
    setEditId(user.id);
  };

  // Handle delete
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "users", id));
      toast.success("User deleted successfully!");
    } catch (err) {
      toast.error("Error deleting user.");
      console.error(err);
    }
  };

  // Filter users by search term
  const filteredCompanies = users.filter(
    (user) =>
      user.userType === "Company" &&
      (user.name.toLowerCase().includes(search.toLowerCase()) ||
       user.mobile.includes(search) ||
       user.address.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredCustomers = users.filter(
    (user) =>
      user.userType === "Customer" &&
      (user.name.toLowerCase().includes(search.toLowerCase()) ||
       user.mobile.includes(search) ||
       user.address.toLowerCase().includes(search.toLowerCase()))
  );

  // Pagination for companies
  const indexOfLastCompany = currentPage * itemsPerPage;
  const indexOfFirstCompany = indexOfLastCompany - itemsPerPage;
  const currentCompanies = filteredCompanies.slice(indexOfFirstCompany, indexOfLastCompany);
  const totalCompanyPages = Math.ceil(filteredCompanies.length / itemsPerPage);

  // Pagination for customers
  const indexOfLastCustomer = currentPage * itemsPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const totalCustomerPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">👤 Add User</h2>
      <form className="grid grid-cols-2 gap-4 mb-6" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          placeholder="Mobile Number"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={userType}
          onChange={(e) => setUserType(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Select Type</option>
          <option value="Customer">Customer</option>
          <option value="Company">Party</option>
        </select>
        <button
          type="submit"
          className="bg-blue-600 text-white font-semibold rounded px-6 py-2 hover:bg-blue-700 transition col-span-2"
        >
          {editId ? "Update User" : "Add User"}
        </button>
      </form>

      <input
        type="text"
        placeholder="🔍 Search by name, mobile, or address..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 border border-gray-300 rounded px-3 py-2 w-full"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Companies List */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Party</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm text-left">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 font-semibold">Name</th>
                  <th className="py-2 px-4 font-semibold">Mobile</th>
                  <th className="py-2 px-4 font-semibold">Address</th>
                  <th className="py-2 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentCompanies.length > 0 ? (
                  currentCompanies.map((user) => (
                    <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-4">{user.name}</td>
                      <td className="py-2 px-4">{user.mobile}</td>
                      <td className="py-2 px-4">{user.address}</td>
                      <td className="py-2 px-4">
                        <button
                          onClick={() => handleEdit(user)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-800 border border-blue-300 rounded hover:bg-blue-200 mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-800 border border-red-300 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-2 px-4 text-center text-gray-500">
                      No companies found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="p-4 flex justify-center gap-2">
              {Array.from({ length: totalCompanyPages }, (_, i) => i + 1).map((number) => (
                <button
                  key={number}
                  onClick={() => paginate(number)}
                  className={`px-3 py-1 rounded ${
                    currentPage === number ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
                  }`}
                >
                  {number}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customers List */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Customers</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm text-left">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 font-semibold">Name</th>
                  <th className="py-2 px-4 font-semibold">Mobile</th>
                  <th className="py-2 px-4 font-semibold">Address</th>
                  <th className="py-2 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentCustomers.length > 0 ? (
                  currentCustomers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-4">{user.name}</td>
                      <td className="py-2 px-4">{user.mobile}</td>
                      <td className="py-2 px-4">{user.address}</td>
                      <td className="py-2 px-4">
                        <button
                          onClick={() => handleEdit(user)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-800 border border-blue-300 rounded hover:bg-blue-200 mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-800 border border-red-300 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-2 px-4 text-center text-gray-500">
                      No customers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="p-4 flex justify-center gap-2">
              {Array.from({ length: totalCustomerPages }, (_, i) => i + 1).map((number) => (
                <button
                  key={number}
                  onClick={() => paginate(number)}
                  className={`px-3 py-1 rounded ${
                    currentPage === number ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
                  }`}
                >
                  {number}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddUser;