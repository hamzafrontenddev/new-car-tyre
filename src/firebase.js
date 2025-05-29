// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDBk5ey-AmHR07nRHR0ZGiwXh1AxXdE7e4",
  authDomain: "srhad-tyers.firebaseapp.com",
  projectId: "srhad-tyers",
  storageBucket: "srhad-tyers.firebasestorage.app",
  messagingSenderId: "784230267116",
  appId: "1:784230267116:web:d70de75d025f1d65c74dc9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };