import { apiClient } from './apiClient';

export interface HomeFeatureDto {
  id?: string;
  title: string;
  subtitle: string;
  iconName?: string;
  customIconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface HomeContentDto {
  id?: string;
  heroTitle: string;
  heroAccent: string;
  heroSubtitle: string;
  primaryCtaLabel: string;
  primaryCtaLink: string;
  secondaryCtaLabel: string;
  secondaryCtaLink: string;
  trustLabel: string;
  heroImageUrl?: string;
  features: HomeFeatureDto[];
}

export interface AudienceCategoryDto {
  id?: string;
  title: string;
  description: string;
  iconName?: string;
  customIconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface AboutContentDto {
  id?: string;
  bannerTitle: string;
  bannerAccent: string;
  bannerSub: string;
  missionTitle: string;
  missionText: string;
  visionTitle: string;
  visionText: string;
  audiences: AudienceCategoryDto[];
}

export interface ServiceItemDto {
  id?: string;
  title: string;
  description: string;
  iconName?: string;
  customIconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ServicesHeaderDto {
  id?: string;
  eyebrow: string;
  title: string;
  accentText: string;
  subtitle: string;
  services: ServiceItemDto[];
}

export interface FaqCategoryDto {
  id?: string;
  name: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface FaqItemDto {
  id?: string;
  categoryId: string;
  categoryName?: string;
  question: string;
  answer: string;
  isPublished: boolean;
  sortOrder?: number;
}

export interface ContactContentDto {
  id?: string;
  heroTitle: string;
  heroAccent: string;
  heroSub: string;
  phone: string;
  email: string;
  operatingHours: string;
  institutionalNote: string;
  ctaTitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonLink: string;
}

export interface RentVsBuyFeatureRowDto {
  id?: string;
  featureLabel: string;
  weeklyValue: string;
  monthlyValue: string;
  purchaseValue: string;
  sortOrder?: number;
}

export interface RentVsBuyCardDto {
  id?: string;
  title: string;
  description: string;
  sortOrder?: number;
}

export interface RentVsBuyContentDto {
  id?: string;
  eyebrow: string;
  title: string;
  accentText: string;
  subtitle: string;
  features: RentVsBuyFeatureRowDto[];
  cards: RentVsBuyCardDto[];
}

export interface WebsiteSettingsDto {
  id?: string;
  showLandingPage: boolean;
  showAboutSection: boolean;
  showServicesSection: boolean;
  showRentVsBuySection: boolean;
  showFaqSection: boolean;
  showContactSection: boolean;
  showHowItWorksSection: boolean;
}

export interface HowItWorksHeaderDto {
  id?: string;
  eyebrow: string;
  title: string;
  accentText: string;
  subtitle: string;
}

export interface HowItWorksStepDto {
  id?: string;
  headerId?: string;
  stepNumber: number;
  title: string;
  description: string;
  iconName?: string;
  customIconUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface HowItWorksSectionDto {
  header: HowItWorksHeaderDto;
  steps: HowItWorksStepDto[];
}

export interface FullWebsiteContentDto {
  home: HomeContentDto;
  about: AboutContentDto;
  services: ServicesHeaderDto;
  faqCategories: FaqCategoryDto[];
  faqs: FaqItemDto[];
  contact: ContactContentDto;
  rentVsBuy: RentVsBuyContentDto;
  howItWorks: HowItWorksSectionDto;
  settings: WebsiteSettingsDto;
}

const isValidGuid = (id?: string): boolean =>
  !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const websiteContentApi = {
  // Public Endpoint for Landing Page
  getPublicContent: async (): Promise<FullWebsiteContentDto> => {
    return await apiClient.get<FullWebsiteContentDto>('/common/website-content');
  },

  // Admin Endpoints
  getAdminContent: async (): Promise<FullWebsiteContentDto> => {
    return await apiClient.get<FullWebsiteContentDto>('/admin/website-content');
  },

  updateHomeContent: async (data: Partial<HomeContentDto>): Promise<HomeContentDto> => {
    const payload = {
      ...data,
      features: data.features?.map((f) => ({
        ...f,
        id: isValidGuid(f.id) ? f.id : undefined,
      })),
    };
    return await apiClient.put<HomeContentDto>('/admin/website-content/home', payload);
  },

  updateAboutContent: async (data: Partial<AboutContentDto>): Promise<AboutContentDto> => {
    return await apiClient.put<AboutContentDto>('/admin/website-content/about', data);
  },

  upsertAudienceCategory: async (data: AudienceCategoryDto): Promise<AudienceCategoryDto> => {
    const payload = {
      ...data,
      id: isValidGuid(data.id) ? data.id : undefined,
    };
    return await apiClient.post<AudienceCategoryDto>('/admin/website-content/about/audience', payload);
  },

  deleteAudienceCategory: async (id: string): Promise<boolean> => {
    return await apiClient.delete<boolean>(`/admin/website-content/about/audience/${id}`);
  },

  updateServicesHeader: async (data: Partial<ServicesHeaderDto>): Promise<ServicesHeaderDto> => {
    return await apiClient.put<ServicesHeaderDto>('/admin/website-content/services/header', data);
  },

  upsertServiceItem: async (data: ServiceItemDto): Promise<ServiceItemDto> => {
    const payload = {
      ...data,
      id: isValidGuid(data.id) ? data.id : undefined,
    };
    return await apiClient.post<ServiceItemDto>('/admin/website-content/services/items', payload);
  },

  deleteServiceItem: async (id: string): Promise<boolean> => {
    return await apiClient.delete<boolean>(`/admin/website-content/services/items/${id}`);
  },

  upsertFaqCategory: async (data: FaqCategoryDto): Promise<FaqCategoryDto> => {
    const payload = {
      ...data,
      id: isValidGuid(data.id) ? data.id : undefined,
    };
    return await apiClient.post<FaqCategoryDto>('/admin/website-content/faqs/categories', payload);
  },

  upsertFaqItem: async (data: FaqItemDto): Promise<FaqItemDto> => {
    const payload = {
      ...data,
      id: isValidGuid(data.id) ? data.id : undefined,
      categoryId: isValidGuid(data.categoryId) ? data.categoryId : undefined,
    };
    return await apiClient.post<FaqItemDto>('/admin/website-content/faqs/items', payload);
  },

  deleteFaqItem: async (id: string): Promise<boolean> => {
    return await apiClient.delete<boolean>(`/admin/website-content/faqs/items/${id}`);
  },

  updateContactContent: async (data: Partial<ContactContentDto>): Promise<ContactContentDto> => {
    return await apiClient.put<ContactContentDto>('/admin/website-content/contact', data);
  },

  updateRentVsBuyHeader: async (data: Partial<RentVsBuyContentDto>): Promise<RentVsBuyContentDto> => {
    return await apiClient.put<RentVsBuyContentDto>('/admin/website-content/rent-vs-buy', data);
  },

  upsertRentVsBuyFeature: async (data: RentVsBuyFeatureRowDto): Promise<RentVsBuyFeatureRowDto> => {
    const payload = {
      ...data,
      id: isValidGuid(data.id) ? data.id : undefined,
    };
    return await apiClient.post<RentVsBuyFeatureRowDto>('/admin/website-content/rent-vs-buy/features', payload);
  },

  deleteRentVsBuyFeature: async (id: string): Promise<boolean> => {
    return await apiClient.delete<boolean>(`/admin/website-content/rent-vs-buy/features/${id}`);
  },

  upsertRentVsBuyCard: async (data: RentVsBuyCardDto): Promise<RentVsBuyCardDto> => {
    const payload = {
      ...data,
      id: isValidGuid(data.id) ? data.id : undefined,
    };
    return await apiClient.post<RentVsBuyCardDto>('/admin/website-content/rent-vs-buy/cards', payload);
  },

  deleteRentVsBuyCard: async (id: string): Promise<boolean> => {
    return await apiClient.delete<boolean>(`/admin/website-content/rent-vs-buy/cards/${id}`);
  },

  updateHowItWorksHeader: async (data: Partial<HowItWorksHeaderDto>): Promise<HowItWorksHeaderDto> => {
    return await apiClient.put<HowItWorksHeaderDto>('/admin/website-content/how-it-works/header', data);
  },

  upsertHowItWorksStep: async (data: HowItWorksStepDto): Promise<HowItWorksStepDto> => {
    const payload = {
      ...data,
      id: isValidGuid(data.id) ? data.id : undefined,
    };
    return await apiClient.post<HowItWorksStepDto>('/admin/website-content/how-it-works/steps', payload);
  },

  deleteHowItWorksStep: async (id: string): Promise<boolean> => {
    return await apiClient.delete<boolean>(`/admin/website-content/how-it-works/steps/${id}`);
  },

  updateWebsiteSettings: async (data: Partial<WebsiteSettingsDto>): Promise<WebsiteSettingsDto> => {
    return await apiClient.put<WebsiteSettingsDto>('/admin/website-content/settings', data);
  },
};
