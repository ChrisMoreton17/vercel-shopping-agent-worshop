"use client";

import Image from "next/image";
import { AgentAddToCartButton } from "@/components/agent-add-to-cart-button";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { formatPrice } from "@/lib/format";
import type { SearchProductsToolInvocation } from "@/lib/agent";

interface AgentProductListProps {
  invocation: SearchProductsToolInvocation;
  onAsk: (text: string) => void;
}

export function AgentProductList({ invocation, onAsk }: AgentProductListProps) {
  if (
    invocation.state === "input-streaming" ||
    invocation.state === "input-available"
  ) {
    const query = invocation.input?.query;
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Searching{query ? ` for "${query}"` : ""}…
      </div>
    );
  }

  if (invocation.state !== "output-available") return null;

  const output = invocation.output;
  if (!output) return null;

  if ("error" in output && output.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {output.error}
      </div>
    );
  }

  if (output.count === 0) {
    return null;
  }

  return (
    <Carousel opts={{ align: "start" }} className="w-full">
      <CarouselContent className="-ml-2">
        {output.products.map((product) => (
          <CarouselItem key={product.id} className="basis-1/2 pl-2">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className="relative aspect-square bg-secondary">
                {product.image && (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex-1">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                    {product.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(product.price, product.currency)}
                  </p>
                </div>
                <AgentAddToCartButton
                  product={{
                    ...product,
                    images: product.image ? [product.image] : [],
                  }}
                  className="w-full"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => onAsk(`Tell me more about the ${product.name}`)}
                >
                  Details
                </Button>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {output.products.length > 2 && (
        <>
          <CarouselPrevious className="top-1/3 left-1" />
          <CarouselNext className="top-1/3 right-1" />
        </>
      )}
    </Carousel>
  );
}
