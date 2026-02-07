import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, Tag } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ColorPicker from '../components/ui/ColorPicker';
import { useBank } from '../context/BankContext';
import FormPopup from '../components/ui/FormPopup';
import ConfirmModal from '../components/ui/ConfirmModal';
import { Category } from '../types';
import { ICONS, COLORS } from '../constants/icons';

const Categories: React.FC = () => {
    const { categories, addCategory, updateCategory, deleteCategory } = useBank();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        icon: 'Tag',
        color: COLORS[0]
    });

    const iconGridRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to selected icon when modal opens
    useEffect(() => {
        if (isModalOpen && iconGridRef.current && formData.icon) {
            const iconButtons = iconGridRef.current.querySelectorAll('button');
            const iconNames = Object.keys(ICONS);
            const selectedIndex = iconNames.indexOf(formData.icon);

            if (selectedIndex !== -1 && iconButtons[selectedIndex]) {
                setTimeout(() => {
                    iconButtons[selectedIndex].scrollIntoView({
                        behavior: 'auto',
                        block: 'center'
                    });
                }, 100);
            }
        }
    }, [isModalOpen, formData.icon]);

    const handleOpenModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                icon: category.icon,
                color: category.color
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                icon: 'Tag',
                color: COLORS[0]
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name.trim()) {
            if (editingCategory) {
                updateCategory({
                    ...editingCategory,
                    name: formData.name.trim(),
                    icon: formData.icon,
                    color: formData.color
                });
            } else {
                addCategory({
                    name: formData.name.trim(),
                    icon: formData.icon,
                    color: formData.color
                });
            }
            setIsModalOpen(false);
        }
    };

    const handleDeleteClick = (id: string, name: string) => {
        setCategoryToDelete({ id, name });
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (categoryToDelete) {
            deleteCategory(categoryToDelete.id);
            setCategoryToDelete(null);
            setIsDeleteModalOpen(false); // Close modal after deletion
        }
    };

    const renderIcon = (iconName: string, className: string = "w-5 h-5") => {
        const Icon = ICONS[iconName] || Tag;
        return <Icon className={className} />;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-200">Gestion des Catégories</h2>
                <Button
                    onClick={() => handleOpenModal()}
                    icon={Plus}
                >
                    Nouvelle Catégorie
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                    <div key={category.id} className="app-card p-4 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-lg text-white"
                                style={{ backgroundColor: category.color }}
                            >
                                {renderIcon(category.icon)}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-gray-200">{category.name}</span>
                        </div>

                        <div className="flex gap-2">
                            {category.id !== 'transfer' && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenModal(category)}
                                        className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        icon={Edit2}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteClick(category.id, category.name)}
                                        className="text-gray-400 hover:text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        icon={Trash2}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <FormPopup
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            >
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">{editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}</h3>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                            <Input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Ex: Loisirs"
                            />
                        </div>


                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Icône</label>
                            <div className="relative">
                                <div ref={iconGridRef} className="grid grid-cols-8 gap-2 max-h-[176px] overflow-y-auto pr-1">
                                    {Object.keys(ICONS).map(iconName => {
                                        const Icon = ICONS[iconName];
                                        return (
                                            <button
                                                key={iconName}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, icon: iconName })}
                                                className={`app-icon-button ${formData.icon === iconName ? 'selected' : ''}`}
                                                title={iconName}
                                            >
                                                <Icon className="w-5 h-5" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Couleur</label>
                            <ColorPicker
                                value={formData.color}
                                onChange={(color) => setFormData({ ...formData, color })}
                                colors={COLORS}
                                size="md"
                            />
                        </div>

                        <div className="pt-4 flex gap-3">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1"
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                            >
                                {editingCategory ? 'Modifier' : 'Ajouter'}
                            </Button>
                        </div>
                    </div>
                </form>
            </FormPopup>

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Supprimer la catégorie"
                message={`Êtes-vous sûr de vouloir supprimer la catégorie "${categoryToDelete?.name}" ?`}
                confirmLabel="Supprimer"
                isDangerous={true}
            />
        </div>
    );
};

export default Categories;
