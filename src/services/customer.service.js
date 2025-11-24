const Customer = require('../models/Customer');

exports.createCustomer = async (payload) => {
  const customer = new Customer(payload);
  const saved = await customer.save();
  return {
    ...saved.toObject(),
    id: saved.id || saved._id.toString(),
    _id: saved._id.toString()
  };
};

exports.getCustomers = async () => {
  const customers = await Customer.find().sort({ createdAt: -1 }).lean();
  return customers.map(customer => ({
    ...customer,
    id: customer.id || customer._id.toString(),
    _id: customer._id.toString()
  }));
};

exports.getCustomerById = async (id) => {
  let customer;
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    customer = await Customer.findOne({ id: parseInt(id) }).lean();
  } else {
    customer = await Customer.findById(id).lean();
  }
  
  if (!customer) return null;
  
  return {
    ...customer,
    id: customer.id || customer._id.toString(),
    _id: customer._id.toString()
  };
};

exports.updateCustomer = async (id, payload) => {
  let updated;
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    updated = await Customer.findOneAndUpdate(
      { id: parseInt(id) }, 
      payload, 
      { new: true, runValidators: true }
    ).lean();
  } else {
    updated = await Customer.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  }
  
  if (!updated) return null;
  
  return {
    ...updated,
    id: updated.id || updated._id.toString(),
    _id: updated._id.toString()
  };
};

exports.deleteCustomer = async (id) => {
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    return await Customer.findOneAndDelete({ id: parseInt(id) });
  } else {
    return await Customer.findByIdAndDelete(id);
  }
};