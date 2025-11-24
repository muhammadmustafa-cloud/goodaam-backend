const Supplier = require('../models/Supplier');

exports.createSupplier = async (payload) => {
  const supplier = new Supplier(payload);
  const saved = await supplier.save();
  // Return with both auto-increment id and MongoDB _id
  return {
    ...saved.toObject(),
    id: saved.id || saved._id.toString(), // Use auto-increment id if available
    _id: saved._id.toString()
  };
};

exports.getSuppliers = async () => {
  const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();
  // Return with both auto-increment id and MongoDB _id
  return suppliers.map(supplier => ({
    ...supplier,
    id: supplier.id || supplier._id.toString(), // Use auto-increment id if available
    _id: supplier._id.toString()
  }));
};

exports.getSupplierById = async (id) => {
  // Support both auto-increment id and MongoDB _id
  let supplier;
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    // Search by auto-increment id
    supplier = await Supplier.findOne({ id: parseInt(id) }).lean();
  } else {
    // Search by MongoDB _id
    supplier = await Supplier.findById(id).lean();
  }
  
  if (!supplier) return null;
  
  return {
    ...supplier,
    id: supplier.id || supplier._id.toString(), // Use auto-increment id if available
    _id: supplier._id.toString()
  };
};

exports.updateSupplier = async (id, payload) => {
  // Support both auto-increment id and MongoDB _id
  let updated;
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    // Update by auto-increment id
    updated = await Supplier.findOneAndUpdate(
      { id: parseInt(id) }, 
      payload, 
      { new: true, runValidators: true }
    ).lean();
  } else {
    // Update by MongoDB _id
    updated = await Supplier.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  }
  
  if (!updated) return null;
  
  return {
    ...updated,
    id: updated.id || updated._id.toString(), // Use auto-increment id if available
    _id: updated._id.toString()
  };
};

exports.deleteSupplier = async (id) => {
  // Support both auto-increment id and MongoDB _id
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    // Delete by auto-increment id
    return await Supplier.findOneAndDelete({ id: parseInt(id) });
  } else {
    // Delete by MongoDB _id
    return await Supplier.findByIdAndDelete(id);
  }
};
