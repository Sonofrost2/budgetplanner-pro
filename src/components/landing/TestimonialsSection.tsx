import { Star, Quote } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const TestimonialsSection = () => {
  const { t } = useLanguage();
  const colors = ['bg-primary', 'bg-secondary', 'bg-accent'];

  return (
    <section id="testimonials" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 mesh-bg opacity-40" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider glass text-secondary mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{t.testimonials.sectionTitle}</h2>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">{t.testimonials.sectionSubtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {t.testimonials.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group p-6 rounded-2xl glass hover:bg-glass-hover transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
            >
              <Quote className="w-6 h-6 text-primary/20 mb-3" />
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground mb-5">"{item.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-glass-border">
                <div className={`w-9 h-9 rounded-full ${colors[i]} flex items-center justify-center text-primary-foreground font-bold text-xs shadow-md`}>
                  {item.name[0]}
                </div>
                <div>
                  <p className="text-xs font-bold">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
