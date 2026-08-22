"use strict";

const Auth = (() => {
  const SESSION_KEY = "campusEmergencySession";
  const accounts = { Student: { email: "student@campus.edu", password: "student123" }, Volunteer: { email: "volunteer@campus.edu", password: "volunteer123" }, Doctor: { email: "doctor@campus.edu", password: "doctor123" } };
  function getSession() { try { const value = JSON.parse(sessionStorage.getItem(SESSION_KEY)); return value && accounts[value.role] && value.email === accounts[value.role].email && typeof value.timestamp === "string" ? value : null; } catch { return null; } }
  function login(role, email, password) { const account = accounts[role]; if (!account || account.email !== email.trim().toLowerCase() || account.password !== password) return null; const session = { role, email: account.email, timestamp: new Date().toISOString() }; try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); return session; } catch { return null; } }
  function logout() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ } }
  return { getSession, login, logout, roles: Object.keys(accounts) };
})();

