/**
 * This is where the tools for your agent will live.
 *
 * During the workshop you'll define tools in this file that your agents
 * will choose to run depending on the question or request that is made
 * to them.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/tools
 */
import { tool } from "ai";
import { z } from "zod";
import {
  ApiRequestError,
  cartAdd,
  createReturn,
  getCategories,
  getOrder,
  getProductById,
  getProducts,
  getProductStock,
  getPromotion,
  notifyReturnInProcess,
  preauthorizeRefund,
} from "@/lib/api";
import { getCartToken } from "@/lib/cart-token";

export const searchProducts = tool({
  description: `Search the Vercel swag store product catalog. Use this for broad lookups: when the user asks about products, what the store sells, or wants recommendations. Returns a short list; for full details or stock on one specific item, follow up with getProductDetails. Optionally narrow results to a single category.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
    category: z
      .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,
      ),
  }),
  execute: async ({ query, category }) => {
    try {
      const products = await getProducts({
        search: query,
        category,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.images[0],
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  },
});

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z.string().describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    try {
      const order = await getOrder(orderId);
      await notifyReturnInProcess(orderId);
      await preauthorizeRefund(orderId);
      const filed = await createReturn({
        orderId: order.id,
        items: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        reason,
      });
      return { returnId: filed.id, status: filed.status };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

export const getProductDetails = tool({
  description: `Get full details and live stock for ONE specific product: description, price, all images, tags, and stock level. Use this whenever the user asks about a particular item (e.g. "tell me more about the black hoodie", "is the beanie in stock?"). If you don't know the product's id or slug yet, call searchProducts first to find it.`,
  inputSchema: z.object({
    productId: z
      .string()
      .describe(
        `The product id (e.g. 'hoodie_001') or slug (e.g. 'black-pullover-hoodie'), taken from a searchProducts result.`,
      ),
  }),
  execute: async ({ productId }) => {
    try {
      // Stock is fetched alongside but is optional: a stock outage shouldn't hide the product.
      const [product, stock] = await Promise.all([
        getProductById(productId),
        getProductStock(productId).catch(() => null),
      ]);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        url: `/products/${product.slug}`,
        description: product.description,
        price: product.price,
        currency: product.currency,
        category: product.category,
        images: product.images,
        tags: product.tags,
        featured: product.featured,
        stock: stock
          ? {
              quantity: stock.stock,
              inStock: stock.inStock,
              lowStock: stock.lowStock,
            }
          : null,
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

export const getCurrentPromotion = tool({
  description: `Get the store's current promotion, if any: title, description, discount percentage, promo code, and validity dates. Use this when the user asks about deals, discounts, sales, or promo codes.`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const promo = await getPromotion();
      // The API can flag a promotion active after its dates have passed, so check them too.
      const now = Date.now();
      if (
        !promo ||
        !promo.active ||
        Date.parse(promo.validFrom) > now ||
        Date.parse(promo.validUntil) < now
      ) {
        return { active: false };
      }
      return {
        active: true,
        title: promo.title,
        description: promo.description,
        discountPercent: promo.discountPercent,
        code: promo.code,
        validUntil: promo.validUntil,
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { active: false, error: message };
    }
  },
});

export const addToCart = tool({
  description: `Add a product to the user's shopping cart. Only use this when the user clearly asks to add or buy a specific item. If you don't know the product's id yet, find it with searchProducts first.`,
  inputSchema: z.object({
    productId: z
      .string()
      .describe(`The product id (e.g. 'hoodie_001'), taken from a searchProducts or getProductDetails result.`),
    quantity: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(1)
      .describe("How many to add. Defaults to 1."),
  }),
  execute: async ({ productId, quantity }) => {
    // The chat route guarantees the cookie exists, since we can't set it mid-stream.
    const token = await getCartToken();
    if (!token) return { error: "No cart found. Ask the user to refresh the page." };
    try {
      const cart = await cartAdd(token, productId, quantity);
      return {
        added: { productId, quantity },
        totalItems: cart.totalItems,
        subtotal: cart.subtotal,
        currency: cart.currency,
        items: cart.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});
