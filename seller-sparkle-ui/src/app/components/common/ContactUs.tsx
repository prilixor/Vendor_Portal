import { Mail, Phone, Clock, Headphones, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { cn } from "@/app/helpers/utils";

const faqs = [
  {
    question: "How long does the vendor approval process take?",
    answer: "Typically, our team verifies business documents within 24–48 business hours. You will receive an email notification once your status is updated."
  },
  {
    question: "Why was my document verification rejected?",
    answer: "Rejections usually occur due to expired documents, blurry images, or mismatched business names. Please check the 'Notes' section in your Verification dashboard for specific feedback."
  },
  {
    question: "How do I update my bank account details?",
    answer: "You can update your financial information in the 'Settings' section. Note that changing bank details may trigger a temporary re-verification process for security."
  },
  {
    question: "Is there a limit to how many products I can list?",
    answer: "No, there is currently no limit on product listings. However, we recommend maintaining high-quality images and accurate descriptions for all items."
  }
];

const ContactUs = () => {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/10">
      {/* Refined Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 lg:px-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-sm">
              <Headphones className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">Support</span>
          </div>
          <Link to="/" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors">
            Portal Access
          </Link>
        </div>
      </header>

      <main className="container mx-auto py-8 lg:py-16 px-4 lg:px-12 max-w-6xl">
        {/* Refined Hero Section - Compact on Mobile */}
        <div className="mb-10 lg:mb-14 text-center">
          <div className="inline-flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-xl lg:rounded-2xl bg-primary/[0.08] text-primary mb-4 lg:mb-5 ring-1 ring-primary/20">
            <MessageSquare className="h-6 w-6 lg:h-7 lg:w-7" />
          </div>
          <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-3 lg:mb-4">
            Contact Us
          </h1>
          <div className="h-1 lg:h-1.5 w-16 lg:w-20 bg-gradient-primary rounded-full mx-auto mb-6 lg:mb-8"></div>
          <p className="text-lg lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-2">
            Need help with onboarding, verification, or account issues? Our support team is here to assist you.
          </p>
        </div>

        {/* Support Cards - Compact & Dense on Mobile */}
        <div className="grid gap-4 lg:gap-8 md:grid-cols-3 mb-12 lg:mb-16">
          <div className="group p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 flex flex-col items-center text-center">
            <div className="flex h-10 w-10 lg:h-14 lg:w-14 items-center justify-center rounded-xl lg:rounded-2xl bg-primary/10 text-primary mb-4 lg:mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-300">
              <Mail className="h-5 w-5 lg:h-7 lg:w-7" />
            </div>
            <h3 className="text-lg lg:text-xl font-bold mb-1 lg:mb-2">Email Support</h3>
            <p className="text-xs lg:text-sm text-muted-foreground mb-4 lg:mb-6">Average response: 24h</p>
            <span className="text-base lg:text-lg font-bold text-primary transition-all">
              support@blinksmed.com
            </span>
          </div>

          <div className="group p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 flex flex-col items-center text-center">
            <div className="flex h-10 w-10 lg:h-14 lg:w-14 items-center justify-center rounded-xl lg:rounded-2xl bg-primary/10 text-primary mb-4 lg:mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-300">
              <Phone className="h-5 w-5 lg:h-7 lg:w-7" />
            </div>
            <h3 className="text-lg lg:text-xl font-bold mb-1 lg:mb-2">Phone Support</h3>
            <p className="text-xs lg:text-sm text-muted-foreground mb-4 lg:mb-6">Direct agent assistance</p>
            <span className="text-base lg:text-lg font-bold text-primary transition-all">
              +91 9876543210
            </span>
          </div>

          <div className="group p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 flex flex-col items-center text-center">
            <div className="flex h-10 w-10 lg:h-14 lg:w-14 items-center justify-center rounded-xl lg:rounded-2xl bg-primary/10 text-primary mb-4 lg:mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-300">
              <Clock className="h-5 w-5 lg:h-7 lg:w-7" />
            </div>
            <h3 className="text-lg lg:text-xl font-bold mb-1 lg:mb-2">Business Hours</h3>
            <p className="text-xs lg:text-sm text-muted-foreground mb-4 lg:mb-6">Operations Timing</p>
            <div className="space-y-0.5 lg:space-y-1">
              <p className="text-base lg:text-lg font-bold text-foreground">9 AM — 6 PM</p>
              <p className="text-[10px] lg:text-[11px] font-bold uppercase tracking-widest text-primary">Monday — Saturday</p>
            </div>
          </div>
        </div>

        {/* Refined FAQ Section - Responsive Spacing */}
        <div className="max-w-4xl mx-auto mb-12 lg:mb-16">
          <div className="flex items-center gap-4 mb-6 lg:mb-10">
             <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-border"></div>
             <h2 className="text-xl lg:text-2xl font-bold text-foreground whitespace-nowrap px-2">Common Questions</h2>
             <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-border"></div>
          </div>
          <Accordion type="single" collapsible className="w-full space-y-3 lg:space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem 
                key={i} 
                value={`faq-${i}`} 
                className="border rounded-xl lg:rounded-2xl px-4 lg:px-6 bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                <AccordionTrigger className="text-[14px] lg:text-[15px] font-bold py-4 lg:py-5 hover:no-underline hover:text-primary transition-colors text-left group">
                  <div className="flex items-center gap-2 lg:gap-3">
                    <span className="text-primary/30 font-mono text-[10px] lg:text-xs group-hover:text-primary transition-colors">0{i+1}</span>
                    {faq.question}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-[13px] lg:text-[14px] text-muted-foreground leading-relaxed pb-4 lg:pb-5 lg:pl-8">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <footer className="mt-12 lg:mt-20 pt-6 lg:pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 lg:gap-6 pb-8 lg:pb-12">
          <p className="text-[12px] lg:text-[13px] text-muted-foreground font-semibold order-2 sm:order-1">
            © 2026 BlinksMed Vendor Portal.
          </p>
          <div className="flex items-center gap-6 lg:gap-8 order-1 sm:order-2">
             <Link to="/terms-and-conditions" className="text-[12px] lg:text-[13px] font-bold text-muted-foreground/80 hover:text-primary transition-colors">Terms</Link>
             <Link to="/privacy-policy" className="text-[12px] lg:text-[13px] font-bold text-muted-foreground/80 hover:text-primary transition-colors">Privacy</Link>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default ContactUs;
