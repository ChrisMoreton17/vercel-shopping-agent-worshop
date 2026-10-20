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
  cartGet,
  getBackOfficeReturns,
  getBackOfficeSales,
  getBackOfficeStock,
  getBackOfficeSupportTickets,
  getCategories,
  getProductById,
  getProducts,
  getProductStock,
  getPromotion,
} from "@/lib/api";
import { start } from "workflow/api";
import { returnFlow } from "./workflows/return-flow";
import { createOrGetSandbox, SANDBOX_NAME } from "@/lib/sandbox";

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
    "use step";
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
    "use step";
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
    "use step";
    const run = await start(returnFlow, [orderId, reason]);
    return {
      runId: run.runId,
      message: `Return request received for order ${orderId}.`,
    };
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
    "use step";
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
    "use step";
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
  // Workflow steps run outside the request, so the chat route passes the
  // shopper's cart token in via toolsContext instead of reading the cookie.
  contextSchema: z.object({ cartToken: z.string() }),
  execute: async ({ productId, quantity }, { context }) => {
    "use step";
    const token = context.cartToken;
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

export const viewCart = tool({
  description: `Show the user's shopping cart: items, quantities, and subtotal. Use this when the user asks to see, review, or check their cart or basket. The cart is shown to the user as an interactive card.`,
  inputSchema: z.object({}),
  contextSchema: z.object({ cartToken: z.string() }),
  execute: async (_input, { context }) => {
    "use step";
    const token = context.cartToken;
    try {
      const cart = await cartGet(token);
      return {
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

export const suggestNextActions = tool({
  description: `Offer the user 2-3 tappable next steps. Call this as the very last thing in every reply. Write each suggestion as something the user would say, e.g. "Show me hoodies", "Add it to my cart", "Any deals on?".`,
  inputSchema: z.object({
    suggestions: z
      .array(z.string().max(40))
      .min(1)
      .max(3)
      .describe("Short follow-ups, phrased in the user's voice."),
  }),
  // Rendered as buttons in the chat; nothing to do on the server.
  execute: async ({ suggestions }) => {
    "use step";
    return { suggestions };
  },
});

// ---------------------------------------------------------------------------
// Back-office tools for the admin agent. Not part of Shippy's tool set: they
// expose customer emails, revenue, and refund data.
// ---------------------------------------------------------------------------

export const getSupportTickets = tool({
  description: `List support tickets from the back office within a date range. Each ticket includes status, priority, category, assignee (staff username or null when unassigned), the related customer/order, and timestamps. Use this for triaging the support queue, spotting spikes in a category, checking workload by assignee, or auditing unresolved urgent tickets. History covers ~last 180 days. Summarize across the rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    category: z
      .enum([
        "shipping",
        "returns",
        "product_quality",
        "sizing",
        "billing",
        "payment",
        "account",
        "other",
      ])
      .optional(),
    assignee: z
      .string()
      .optional()
      .describe(
        `Staff username (e.g. "alex"). When set, unassigned tickets are excluded.`,
      ),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  execute: async ({
    from,
    to,
    status,
    priority,
    category,
    assignee,
    limit,
  }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeSupportTickets({
        from,
        to,
        status,
        priority,
        category,
        assignee,
        limit,
      });
      return { count: data.length, tickets: data, range: meta };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, tickets: [], error: message };
    }
  },
});

export const getReturnsHistory = tool({
  description: `List historical returns from the back office within a date range. Each entry includes the items returned, the decision (approved/rejected/needs_info), refund amount in cents (divide by 100 for dollar amounts in your reply), and a summary of the related order. Use this for return triage, refund auditing, or identifying products with high return volumes. History covers ~last 180 days. Summarize across the returned rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    status: z.enum(["pending", "processing", "completed"]).optional(),
    decision: z.enum(["approved", "rejected", "needs_info"]).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  execute: async ({ from, to, status, decision, limit }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeReturns({
        from,
        to,
        status,
        decision,
        limit,
      });
      return { count: data.length, returns: data, range: meta };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, returns: [], error: message };
    }
  },
});

export const getInventoryStock = tool({
  description: `Current stock levels for all products (or a subset). Results are sorted by stock ascending, so out-of-stock and low-stock items appear first. Use this to answer questions about availability, restocking priorities, or which items are about to run out. Summarize the rows in your reply rather than dumping them.`,
  inputSchema: z.object({
    productIds: z
      .array(z.string())
      .optional()
      .describe(`Restrict the query to specific product ids.`),
    lowStock: z
      .boolean()
      .optional()
      .describe(
        `true = only items with 1–5 units in stock; false = exclude low-stock items.`,
      ),
    inStock: z
      .boolean()
      .optional()
      .describe(`true = only items with at least one unit; false = only zero.`),
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  execute: async ({ productIds, lowStock, inStock, page, limit }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeStock({
        productIds,
        lowStock,
        inStock,
        page,
        limit,
      });
      return { count: data.length, stock: data, pagination: meta.pagination };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, stock: [], error: message };
    }
  },
});

export const getSalesAnalytics = tool({
  description: `Sales totals by product within a date range. Each row reports unitsSold, ordersCount, and revenue in cents (divide by 100 for dollar amounts in your reply). Results are sorted by unitsSold descending. Pair with getReturnsHistory to compute per-product return rates. Sales data covers ~last 180 days. Summarize across the rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    productId: z
      .string()
      .optional()
      .describe(`Restrict to a single product. 404s if it doesn't exist.`),
  }),
  execute: async ({ from, to, productId }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeSales({ from, to, productId });
      return { count: data.length, sales: data, summary: meta };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, sales: [], error: message };
    }
  },
});

// Runs in the shared, persistent admin sandbox. Admin-only: never add this to
// Shippy's tool set, since it executes arbitrary commands.
export const bash = tool({
  description: "Run a bash command in the sandbox environment",
  inputSchema: z.object({
    command: z.string().describe("The bash command to run"),
  }),
  execute: async ({ command }) => {
    "use step";
    const sandbox = await createOrGetSandbox(SANDBOX_NAME);
    const result = await sandbox.runCommand("bash", ["-lc", command]);
    return {
      stdout: await result.stdout(),
      stderr: await result.stderr(),
      exitCode: result.exitCode,
    };
  },
});
