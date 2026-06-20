// v1: everything is free. This is the SINGLE future insertion point for Pro gating.
export interface LicenseGate {
  isAllowed(feature: string): boolean;
}

export const licenseGate: LicenseGate = {
  isAllowed: () => true,
};
