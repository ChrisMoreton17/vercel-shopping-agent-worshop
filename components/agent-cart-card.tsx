"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { formatPrice } from "@/lib/format";
import type {
  AddToCartToolInvocation,
  ViewCartToolInvocation,
} from "@/lib/agent";

interface AgentCartCardProps {
  invocation: AddToCartToolInvocation | ViewCartToolInvocation;
  title: string;
}

// Renders the live cart rather than the tool's snapshot, so quantity changes
// here, in the cart drawer, and from later agent adds all stay in sync.
export function AgentCartCard({ invocation, title }: AgentCartCardProps) {
  const { cart, removeFromCart, updateQuantity, refreshCart } = useCart();
  const done = invocation.state === "output-available";

  // The tool changed or read the cart server-side; pull it into the provider.
  useEffect(() => {
    if (done) refreshCart();
  }, [done, refreshCart]);

  if (
    invocation.state === "input-streaming" ||
    invocation.state === "input-available"
  ) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Updating your cart…
      </div>
    );
  }

  if (!done) return null;

  const output = invocation.output;
  if (output && "error" in output && output.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {output.error}
      </div>
    );
  }

  const currency = cart.currency || "USD";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">
        {title}
      </div>
      {cart.items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Your cart is empty.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {cart.items.map((item) => (
              <li key={item.productId} className="flex items-center gap-3 p-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
                  {item.product.images[0] && (
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.product.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity - 1)
                      }
                      className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity + 1)
                      }
                      className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatPrice(item.lineTotal, currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-border p-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Subtotal</span>
              <span>{formatPrice(cart.subtotal, currency)}</span>
            </div>
            <Button disabled className="w-full">
              Checkout
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Checkout coming soon
            </p>
          </div>
        </>
      )}
    </div>
  );
}
