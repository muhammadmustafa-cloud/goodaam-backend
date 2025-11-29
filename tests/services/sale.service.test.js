/**
 * Unit tests for Sale Service with bagWeight functionality
 */

const mongoose = require('mongoose');
const Sale = require('../../src/models/Sale');
const LaadItem = require('../../src/models/LaadItem');
const Customer = require('../../src/models/Customer');
const saleService = require('../../src/services/sale.service');

describe('Sale Service', () => {
  let testCustomer;
  let testLaadItem;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/godam_test');
  });

  afterAll(async () => {
    await Sale.deleteMany({});
    await LaadItem.deleteMany({});
    await Customer.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Sale.deleteMany({});
    await LaadItem.deleteMany({});
    await Customer.deleteMany({});

    // Create test customer
    testCustomer = new Customer({
      name: 'Test Customer',
      contact: '1234567890'
    });
    await testCustomer.save();

    // Create test laad item
    testLaadItem = new LaadItem({
      laadId: new mongoose.Types.ObjectId(),
      itemId: new mongoose.Types.ObjectId(),
      totalBags: 100,
      remainingBags: 50,
      qualityGrade: 'Premium'
    });
    await testLaadItem.save();
  });

  describe('createSale with bagWeight', () => {
    test('should create sale with valid bagWeight', async () => {
      const payload = {
        customerId: testCustomer._id.toString(),
        laadItemId: testLaadItem._id.toString(),
        bagsSold: 10,
        bagWeight: 50.5,
        ratePerBag: 1000
      };

      const result = await saleService.createSale(payload);

      expect(result).toBeDefined();
      expect(result.bagsSold).toBe(10);
      expect(result.bagWeight).toBe(50.5);
      expect(result.customerId.toString()).toBe(testCustomer._id.toString());
      expect(result.laadItemId.toString()).toBe(testLaadItem._id.toString());

      // Check if stock was updated
      const updatedLaadItem = await LaadItem.findById(testLaadItem._id);
      expect(updatedLaadItem.remainingBags).toBe(40); // 50 - 10
    });

    test('should reject sale without bagWeight', async () => {
      const payload = {
        customerId: testCustomer._id.toString(),
        laadItemId: testLaadItem._id.toString(),
        bagsSold: 10,
        ratePerBag: 1000
      };

      await expect(saleService.createSale(payload)).rejects.toThrow('bagWeight is required');
    });

    test('should reject sale with negative bagWeight', async () => {
      const payload = {
        customerId: testCustomer._id.toString(),
        laadItemId: testLaadItem._id.toString(),
        bagsSold: 10,
        bagWeight: -5
      };

      await expect(saleService.createSale(payload)).rejects.toThrow('bagWeight must be greater than 0');
    });

    test('should handle decimal bagWeight values', async () => {
      const payload = {
        customerId: testCustomer._id.toString(),
        laadItemId: testLaadItem._id.toString(),
        bagsSold: 5,
        bagWeight: 47.5
      };

      const result = await saleService.createSale(payload);
      expect(result.bagWeight).toBe(47.5);
    });

    test('should update stock correctly with custom bagWeight', async () => {
      const payload = {
        customerId: testCustomer._id.toString(),
        laadItemId: testLaadItem._id.toString(),
        bagsSold: 20,
        bagWeight: 80 // Customer wants 80kg bags
      };

      await saleService.createSale(payload);

      const updatedLaadItem = await LaadItem.findById(testLaadItem._id);
      expect(updatedLaadItem.remainingBags).toBe(30); // 50 - 20 bags

      // Verify sale record
      const sale = await Sale.findOne({ customerId: testCustomer._id });
      expect(sale.bagWeight).toBe(80);
    });
  });

  describe('updateSale with bagWeight', () => {
    let existingSale;

    beforeEach(async () => {
      existingSale = new Sale({
        customerId: testCustomer._id,
        laadItemId: testLaadItem._id,
        bagsSold: 5,
        bagWeight: 50
      });
      await existingSale.save();

      // Update stock to reflect the sale
      testLaadItem.remainingBags = 45; // 50 - 5
      await testLaadItem.save();
    });

    test('should update sale bagWeight', async () => {
      const payload = {
        customerId: testCustomer._id.toString(),
        laadItemId: testLaadItem._id.toString(),
        bagsSold: 5,
        bagWeight: 75 // Changed from 50 to 75
      };

      const result = await saleService.updateSale(existingSale._id.toString(), payload);

      expect(result.bagWeight).toBe(75);
      expect(result.bagsSold).toBe(5);

      // Stock should remain the same (only bag count matters for stock)
      const updatedLaadItem = await LaadItem.findById(testLaadItem._id);
      expect(updatedLaadItem.remainingBags).toBe(45);
    });

    test('should reject update without bagWeight', async () => {
      const payload = {
        customerId: testCustomer._id.toString(),
        laadItemId: testLaadItem._id.toString(),
        bagsSold: 5
      };

      await expect(saleService.updateSale(existingSale._id.toString(), payload))
        .rejects.toThrow('bagWeight is required');
    });
  });
});
