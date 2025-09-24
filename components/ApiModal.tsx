"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { cn } from "../lib/utils"; // Adjust the path as needed

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useApiKeyStore from "@/store/api";
import { toast } from "sonner";
interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: string | null;
}

export default function ApiModal({ isOpen, onClose, error }: ApiModalProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { apiKey, setApiKey } = useApiKeyStore();
  const handleSave = () => {
    const apiKey = inputRef.current?.value || "";
    if (apiKey.trim()) {
      setApiKey(inputRef.current?.value || "");
      toast.success("API Key saved");
      onClose();
    }
  };
  const disabled = apiKey === "" || apiKey === undefined;
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enter API KEY</DialogTitle>
          <DialogDescription>
            <>
              {" "}
              You can get your API key from{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Google AI Studio
              </a>
              .
            </>
          </DialogDescription>
        </DialogHeader>
        <label className="text-sm font-medium leading-none" htmlFor="apiKey">
          API Key
        </label>
        <div className="relative">
          <Input
            id="apiKey"
            defaultValue={apiKey || ""}
            placeholder="Enter your API key"
            className={cn(
              "hide-password-toggle pr-10",
              error && "border-red-500"
            )}
            ref={inputRef}
            type={showPassword ? "text" : "password"}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            disabled={disabled}
          >
            {showPassword && !disabled ? (
              <EyeIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="sr-only">
              {showPassword ? "Hide password" : "Show password"}
            </span>
          </Button>
          {/* hides browsers password toggles */}
          <style>{`
					.hide-password-toggle::-ms-reveal,
					.hide-password-toggle::-ms-clear {
						visibility: hidden;
						pointer-events: none;
						display: none;
					}
				`}</style>
        </div>
        {error && (
          <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSave}>Save API Key</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
