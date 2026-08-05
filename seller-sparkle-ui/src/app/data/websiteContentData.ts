export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  iconName?: string;
  customIconUrl?: string;
}

export interface ServicesContentData {
  eyebrow: string;
  title: string;
  accentText: string;
  subtitle: string;
  services: ServiceItem[];
}

export interface AudienceItem {
  id: string;
  title: string;
  description: string;
  iconName?: string;
  customIconUrl?: string;
}

export interface AboutContentData {
  bannerTitle: string;
  bannerAccent: string;
  bannerSub: string;
  missionText: string;
  visionText: string;
  audiences: AudienceItem[];
}

export const defaultServicesContent: ServicesContentData = {
  eyebrow: "OUR SERVICES",
  title: "Medical equipment & ",
  accentText: "laboratory supplies.",
  subtitle: "Rent or buy equipment. Buy lab chemicals. All in one place.",
  services: [
    {
      id: "srv_1",
      title: "Medical Equipment",
      description: "Hospital beds, wheelchairs, oxygen concentrators, and more. Available for rent or purchase.",
      iconName: "Stethoscope",
    },
    {
      id: "srv_2",
      title: "Laboratory Chemicals",
      description: "Quality reagents and consumables for labs. Available for purchase only.",
      iconName: "FlaskConical",
    },
    {
      id: "srv_3",
      title: "Healthcare Marketplace",
      description: "One platform connecting customers with trusted, verified suppliers.",
      iconName: "Layers",
    },
    {
      id: "srv_4",
      title: "Delivery & Support",
      description: "Reliable assistance throughout the customer journey, from order to setup.",
      iconName: "Truck",
    },
    {
      id: "srv_5",
      title: "Bulk Procurement",
      description: "Solutions for hospitals, clinics, laboratories, and institutions.",
      iconName: "Building2",
    },
    {
      id: "srv_6",
      title: "Verified Suppliers",
      description: "Every supplier is vetted before they can list products on the platform.",
      iconName: "ShieldCheck",
    },
  ],
};

export const defaultAboutContent: AboutContentData = {
  bannerTitle: "A simpler way to access",
  bannerAccent: "healthcare products.",
  bannerSub: "We exist to make sourcing healthcare products safer and more transparent, so hospitals, clinics, and families can rely on every supplier we work with.",
  missionText: "To make healthcare products more accessible through technology, trusted suppliers, and a seamless customer experience, removing the friction from renting, buying, and sourcing what care requires.",
  visionText: "To become one of the most trusted healthcare marketplaces, simplifying how medical equipment and laboratory products are accessed by individuals and institutions alike.",
  audiences: [
    { id: "a1", title: "Individuals", description: "Personal access to home healthcare equipment.", iconName: "User" },
    { id: "a2", title: "Families", description: "Equipment for caring for a loved one at home.", iconName: "Users" },
    { id: "a3", title: "Hospitals", description: "Reliable equipment sourcing at institutional scale.", iconName: "Building2" },
    { id: "a4", title: "Clinics", description: "Flexible rental and purchase options for daily practice.", iconName: "Hospital" },
    { id: "a5", title: "Laboratories", description: "Trusted sourcing for laboratory chemicals.", iconName: "FlaskConical" },
    { id: "a6", title: "Healthcare Professionals", description: "Quick access to trusted equipment and supplies.", iconName: "Stethoscope" },
    { id: "a7", title: "Rehabilitation Centers", description: "Mobility and recovery equipment, rented or bought.", iconName: "Activity" },
    { id: "a8", title: "Research Organizations", description: "Consistent supply of laboratory-grade chemicals.", iconName: "Microscope" },
  ],
};

let currentServicesContent: ServicesContentData = { ...defaultServicesContent };
let currentAboutContent: AboutContentData = { ...defaultAboutContent };

export const getServicesContent = (): ServicesContentData => {
  return currentServicesContent;
};

export const updateServicesContent = (newData: ServicesContentData): ServicesContentData => {
  currentServicesContent = { ...newData };
  return currentServicesContent;
};

export const getAboutContent = (): AboutContentData => {
  return currentAboutContent;
};

export const updateAboutContent = (newData: AboutContentData): AboutContentData => {
  currentAboutContent = { ...newData };
  return currentAboutContent;
};
