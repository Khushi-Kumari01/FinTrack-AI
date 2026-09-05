// src/components/DateRangePicker.jsx
import React from "react";

const options = ["7d", "30d", "90d"];

const DateRangePicker = ({ value, onChange }) => {
  return (
    <div className="date-range">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={value === opt ? "active" : ""}
          onClick={() => onChange(opt)}
        >
          {opt === "7d" ? "Last 7 days" : opt === "30d" ? "30 days" : "90 days"}
        </button>
      ))}
    </div>
  );
};

export default DateRangePicker;
