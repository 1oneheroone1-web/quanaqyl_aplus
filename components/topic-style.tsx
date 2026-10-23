import { Ruler, MoveRight, Gauge, Magnet, Zap, Orbit, Globe2, Waves, Thermometer, AudioLines, CircuitBoard } from 'lucide-react';
import { L, type Lang } from '@/lib/catalog';
const icons = [Ruler, MoveRight, Gauge, Magnet, Zap, Orbit, Globe2, Waves, Thermometer, Waves, AudioLines, Zap, CircuitBoard, CircuitBoard];
export const topicTones = ['sky', 'mint', 'lilac', 'amber', 'lilac', 'mint', 'rose', 'amber', 'sky', 'mint', 'lilac', 'amber', 'sky', 'mint'];
export const topicDescriptions = [
    L('SI units, uncertainty and vectors', 'Единицы СИ, погрешности и векторы', 'ХБЖ бірліктері, қателіктер және векторлар'),
    L('Displacement, speed and acceleration', 'Перемещение, скорость и ускорение', 'Орын ауыстыру, жылдамдық және үдеу'),
    L('Newton’s laws and momentum', 'Законы Ньютона и импульс', 'Ньютон заңдары және импульс'),
    L('Gravity, friction and elasticity', 'Тяжесть, трение и упругость', 'Ауырлық, үйкеліс және серпімділік'),
    L('Work and conservation of energy', 'Работа и сохранение энергии', 'Жұмыс және энергияның сақталуы'),
    L('Centripetal acceleration and force', 'Центростремительные ускорение и сила', 'Центрге тартқыш үдеу және күш'),
    L('Gravitation and field strength', 'Тяготение и напряжённость поля', 'Тартылыс және өріс кернеулігі'),
    L('Period, frequency and harmonic motion', 'Период, частота и гармонические колебания', 'Период, жиілік және гармоникалық тербелістер'),
    L('Temperature, heat and internal energy', 'Температура, теплота и внутренняя энергия', 'Температура, жылу және ішкі энергия'),
    L('Wavelength, frequency and wave speed', 'Длина волны, частота и скорость', 'Толқын ұзындығы, жиілік және жылдамдық'),
    L('Interference and standing waves', 'Интерференция и стоячие волны', 'Интерференция және тұрғын толқындар'),
    L('Charge, field strength and potential', 'Заряд, напряжённость и потенциал', 'Заряд, кернеулік және потенциал'),
    L('Current, charge and resistance', 'Сила тока, заряд и сопротивление', 'Ток күші, заряд және кедергі'),
    L('Resistors and Ohm’s law', 'Соединения резисторов и закон Ома', 'Резисторларды жалғау және Ом заңы'),
];
export function TopicIcon({ topic }: {
    topic: number;
}) {
    const Icon = icons[topic] ?? Ruler;
    return <Icon className="topic-symbol" size={24} strokeWidth={1.7} aria-hidden="true"/>;
}
export function TopicDescription({ topic, lang }: {
    topic: number;
    lang: Lang;
}) {
    return <span className="topic-description">{topicDescriptions[topic]?.[lang]}</span>;
}
