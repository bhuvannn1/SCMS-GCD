
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// 🛑 ANTI-CRASH PATCH FOR GOOGLE TRANSLATE 🛑
// Google Translate wraps text nodes in <font> tags. React loses track of the 
// original text nodes and throws a loop/stack overflow when trying to unmount them.
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function(child) {
    if (child.parentNode !== this) {
      if (console) {
        console.warn('Google Translate Crash Prevented: Node not found.');
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };
  
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function(newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) {
        console.warn('Google Translate Crash Prevented: Reference node not found.');
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
