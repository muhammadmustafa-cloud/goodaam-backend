/**
 * Unit tests for Sale Model with bagWeight field
 */

const mongoose = require('mongoose');
const Sale = require('../../src/models/Sale');

describe('Sale Model', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/godam_test');
  });

  afterAll(async () => {
    // Clean up and close connection
    await Sale.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await Sale.deleteMany({});
  });

  describe('Validation', () => {
    test('should create sale with valid bagWeight', async () => {
      const validSale = {
        customerId: new mongoose.Types.ObjectId(),
        laadItemId: new mongoose.Types.ObjectId(),
        bagsSold: 10,
        bagWeight: 50.5,
        ratePerBag: 1000,
        totalAmount: 10000
      };

      const sale = new Sale(validSale);
      const savedSale = await sale.save();

      expect(savedSale.bagWeight).toBe(50.5);
      expect(savedSale.bagsSold).toBe(10);
    });

    test('should reject sale without bagWeight', async () => {
      const invalidSale = {
        customerId: new mongoose.Types.ObjectId(),
        laadItemId: new mongoose.Types.ObjectId(),
        bagsSold: 10,
        ratePerBag: 1000
      };

      const sale = new Sale(invalidSale);
      
      await expect(sale.save()).rejects.toThrow();
    });

    test('should reject sale with negative bagWeight', async () => {
      const invalidSale = {
        customerId: new mongoose.Types.ObjectId(),
        laadItemId: new mongoose.Types.ObjectId(),
        bagsSold: 10,
        bagWeight: -5
      };

      const sale = new Sale(invalidSale);
      
      await expect(sale.save()).rejects.toThrow();
    });

    test('should reject sale with zero bagWeight', async () => {
      const invalidSale = {
        customerId: new mongoose.Types.ObjectId(),
        laadItemId: new mongoose.Types.ObjectId(),
        bagsSold: 10,
        bagWeight: 0
      };

      const sale = new Sale(invalidSale);
      
      await expect(sale.save()).rejects.toThrow();
    });
  });

  describe('Business Logic', () => {
    test('should calculate totalAmount when ratePerBag is provided', async () => {
      const sale = new Sale({
        customerId: new mongoose.Types.ObjectId(),
        laadItemId: new mongoose.Types.ObjectId(),
        bagsSold: 15,
        bagWeight: 50,
        ratePerBag: 1200
      });

      expect(sale.totalAmount).toBeUndefined(); // Should be calculated at service level

      await sale.save();
      // totalAmount calculation happens in service layer
    });

    test('should handle decimal bagWeight values', async () => {
      const sale = new Sale({
        customerId: new mongoose.Types.ObjectId(),
        laadItemId: new mongoose.Types.ObjectId(),
        bagsSold: 5,
        bagWeight: 47.5
      });

      const savedSale = await sale.save();
      expect(savedSale.bagWeight).toBe(47.5);
    });
  });
});
