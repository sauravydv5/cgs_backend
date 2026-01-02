import mongoose from "mongoose";

const employeeLogSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    action: {
      type: String, // EMPLOYEE_CREATED, ROLE_ASSIGNED
    },
    description: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // admin
    },
  },
  { timestamps: true }
);

export default mongoose.model("EmployeeLog", employeeLogSchema);
