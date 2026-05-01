"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchBar({ initialValue = "" }: { initialValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  const submit = () => {
    const ticker = value.trim().toUpperCase();
    if (!ticker) return;
    router.push(`/dashboard/${encodeURIComponent(ticker)}`);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1.5 backdrop-blur-md focus-within:border-foreground/30"
    >
      <Search className="h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder="Search ticker (e.g. AAPL)"
        className="h-8 border-0 bg-transparent px-0 font-mono tracking-wider shadow-none focus-visible:ring-0"
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit" size="sm" variant="secondary" className="h-7 px-3 text-xs">
        Search
      </Button>
    </form>
  );
}
