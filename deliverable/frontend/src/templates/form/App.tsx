
import React, { useState } from 'react';

function App() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    priority: 'medium'
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };

  return (
    <div className="container">
      <h1>Customer Support Request</h1>
      <div className="form-container">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email Address:</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="message">Support Message:</label>
            <textarea
              id="message"
              name="message"
              rows={4}
              placeholder="Describe your support request or issue"
              value={formData.message}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="priority">Request Priority:</label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
            >
              <option value="low">Low (Non-urgent)</option>
              <option value="medium">Medium (Standard)</option>
              <option value="high">High (Urgent)</option>
            </select>
          </div>
          <button type="submit">Submit Support Request</button>
        </form>
      </div>
      
      {submitted && (
        <div className="result">
          <h3>Support Request Submitted</h3>
          <p><strong>Name:</strong> {formData.name}</p>
          <p><strong>Email:</strong> {formData.email}</p>
          <p><strong>Message:</strong> {formData.message}</p>
          <p><strong>Priority:</strong> {formData.priority}</p>
        </div>
      )}
    </div>
  );
}

export default App;
