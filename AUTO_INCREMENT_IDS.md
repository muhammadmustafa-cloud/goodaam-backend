# ✅ Auto-Increment IDs Implementation

## 🎯 Solution Overview

Professional auto-increment ID system using MongoDB counter collection pattern.

---

## 📋 How It Works

### 1. **Counter Collection**
- Separate collection stores sequence numbers for each model
- Each model has its own counter (Supplier, Customer, Item, Vehicle, etc.)
- Uses MongoDB transactions for atomicity (no duplicate IDs)

### 2. **Pre-Save Hook**
- Automatically generates ID before saving new documents
- Only runs for new documents (not updates)
- Uses `getNextSequence()` utility function

### 3. **Dual ID Support**
- **Auto-increment ID**: `id: 1, 2, 3, ...` (for frontend)
- **MongoDB _id**: `_id: ObjectId(...)` (for database)
- Both are returned in API responses

---

## 🔧 Implementation Details

### Counter Model (`Counter.js`)
```javascript
{
  _id: "Supplier",  // Model name
  sequence: 5      // Current counter value
}
```

### Auto-Increment Utility (`autoIncrement.js`)
- `getNextSequence(modelName)` - Get next ID atomically
- `resetCounter(modelName, startFrom)` - Reset counter
- `getCurrentSequence(modelName)` - Get current value

### Model Schema Example
```javascript
const supplierSchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true,
    index: true
  },
  // ... other fields
});

// Pre-save hook
supplierSchema.pre('save', async function (next) {
  if (this.isNew && !this.id) {
    this.id = await getNextSequence('Supplier');
  }
  next();
});
```

---

## ✅ Features

1. **Thread-Safe**: Uses MongoDB transactions
2. **No Duplicates**: Unique constraint on `id` field
3. **Indexed**: Fast lookups by auto-increment ID
4. **Backward Compatible**: Still supports MongoDB `_id`
5. **Flexible**: Works with both numeric and ObjectId queries

---

## 📊 API Response Format

**Before:**
```json
{
  "_id": "692472b7e786ac4df7a8525b",
  "name": "Saleem",
  ...
}
```

**After:**
```json
{
  "_id": "692472b7e786ac4df7a8525b",
  "id": 1,  // ✅ Auto-increment ID
  "name": "Saleem",
  ...
}
```

---

## 🔍 Query Support

### By Auto-Increment ID
```javascript
// Service automatically detects numeric ID
await Supplier.findOne({ id: 1 });
await Supplier.findByIdAndUpdate(1, {...});
```

### By MongoDB _id
```javascript
// Still works with ObjectId
await Supplier.findById("692472b7e786ac4df7a8525b");
```

---

## 📋 Models Updated

- ✅ **Supplier** - Auto-increment ID added
- ✅ **Customer** - Auto-increment ID added
- ✅ **Item** - Auto-increment ID added
- ✅ **Vehicle** - Auto-increment ID added

---

## 🚀 Usage

### Creating New Record
```javascript
const supplier = new Supplier({
  name: "Saleem",
  contact: "0354-6887416"
});
await supplier.save();
// ID automatically generated: id: 1
```

### Querying
```javascript
// By auto-increment ID
const supplier = await Supplier.findOne({ id: 1 });

// By MongoDB _id (still works)
const supplier = await Supplier.findById("692472b7e786ac4df7a8525b");
```

---

## 🛠️ Management Functions

### Reset Counter
```javascript
const { resetCounter } = require('./src/utils/autoIncrement');
await resetCounter('Supplier', 0); // Start from 0
```

### Get Current Counter
```javascript
const { getCurrentSequence } = require('./src/utils/autoIncrement');
const current = await getCurrentSequence('Supplier');
console.log(`Next ID will be: ${current + 1}`);
```

---

## ⚠️ Important Notes

1. **Existing Records**: Old records won't have auto-increment `id` field
   - They'll still work with `_id`
   - New records will have both

2. **Migration**: If you want to add IDs to existing records:
   ```javascript
   // Run migration script to assign IDs to existing records
   const suppliers = await Supplier.find({ id: { $exists: false } });
   for (const supplier of suppliers) {
     supplier.id = await getNextSequence('Supplier');
     await supplier.save();
   }
   ```

3. **Performance**: Counter collection is indexed and fast
   - Uses atomic operations
   - No performance impact

---

## ✅ Benefits

- ✅ **Professional**: Industry-standard pattern
- ✅ **Scalable**: Works with millions of records
- ✅ **Thread-Safe**: No race conditions
- ✅ **Flexible**: Supports both ID types
- ✅ **User-Friendly**: Simple numeric IDs (1, 2, 3...)

---

## 🎉 Result

**Frontend will now see:**
- `id: 1` instead of `_id: "692472b7e786ac4df7a8525b"`
- Clean, sequential IDs
- Professional appearance

**Backend still uses:**
- MongoDB `_id` for internal operations
- Auto-increment `id` for user-facing operations
- Both work seamlessly!

---

**Auto-increment IDs are now live!** 🚀

