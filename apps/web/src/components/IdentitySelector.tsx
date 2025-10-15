import { useIdentity } from "@/contexts/IdentityContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, User, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function IdentitySelector() {
  const {
    currentIdentity,
    personalIdentity,
    companyIdentities,
    switchIdentity,
    isSwitching,
    isLoading,
  } = useIdentity();

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="w-[200px]">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  if (!currentIdentity) {
    return null;
  }

  const handleIdentitySwitch = async (identityId: number) => {
    if (identityId === currentIdentity.id || isSwitching) {
      return;
    }

    try {
      await switchIdentity(identityId);
    } catch (error) {
      console.error('Failed to switch identity:', error);
      // Could show a toast notification here
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-[200px] justify-between"
          disabled={isSwitching}
        >
          <div className="flex items-center gap-2 truncate">
            {currentIdentity.type === 'user' ? (
              <User className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Building2 className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="truncate">{currentIdentity.displayName}</span>
          </div>
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[250px]">
        <DropdownMenuLabel>Switch Identity</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Personal Identity */}
        {personalIdentity && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Personal
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => handleIdentitySwitch(personalIdentity.id)}
              className={cn(
                "cursor-pointer",
                currentIdentity.id === personalIdentity.id && "bg-accent"
              )}
              disabled={isSwitching}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{personalIdentity.displayName}</span>
                </div>
                {currentIdentity.id === personalIdentity.id && (
                  <Check className="h-4 w-4" />
                )}
              </div>
            </DropdownMenuItem>
          </>
        )}

        {/* Company Identities */}
        {companyIdentities.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Companies
            </DropdownMenuLabel>
            {companyIdentities.map((identity) => (
              <DropdownMenuItem
                key={identity.id}
                onClick={() => handleIdentitySwitch(identity.id)}
                className={cn(
                  "cursor-pointer",
                  currentIdentity.id === identity.id && "bg-accent"
                )}
                disabled={isSwitching}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{identity.displayName}</span>
                      {identity.role && (
                        <span className="text-xs text-muted-foreground">
                          {identity.role}
                        </span>
                      )}
                    </div>
                  </div>
                  {currentIdentity.id === identity.id && (
                    <Check className="h-4 w-4" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* No companies message */}
        {!personalIdentity && companyIdentities.length === 0 && (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No identities available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}