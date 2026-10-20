"use client";

import { useEffect, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/lib/types";

// Tool outputs carry a subset of Product; the cart only needs these fields.
export type AgentProduct = Pick<
  Product,
  "id" | "name" | "slug" | "description" | "price" | "currency" | "category"
> & { images: string[]; tags?: string[] };

interface AgentAddToCartButtonProps {
  product: AgentProduct;
  disabled?: boolean;
  className?: string;
}

export function AgentAddToCartButton({
  product,
  disabled,
  className,
}: AgentAddToCartButtonProps) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(t);
  }, [added]);

  const handleClick = () => {
    addToCart(
      { tags: [], featured: false, createdAt: "", ...product },
      1,
    );
    setAdded(true);
  };

  return (
    <Button
      size="sm"
      className={className}
      disabled={disabled}
      onClick={handleClick}
    >
      {added ? <Check /> : <ShoppingCart />}
      {added ? "Added" : "Add to cart"}
    </Button>
  );
}
