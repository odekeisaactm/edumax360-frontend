// app/dashboard/staff/academic/promotion-mappings/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { academicAPI } from '@/lib/api';
import { ClassModel, ClassConfiguration } from '@/lib/types';
import {
  ArrowRight,
  Save,
  RotateCcw,
  AlertCircle,
  Check,
  Info,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';

interface ConfigMapping {
  from_config_id: number;
  from_config_name: string;
  from_class_id: number;
  from_class_name: string;
  from_section_name: string | null;
  to_config_id: number | null;
  suggested_to_config_id: number | null;
  is_graduation: boolean;
  class_order: number;
}

interface GroupedMappings {
  [className: string]: ConfigMapping[];
}

export default function PromotionMappingsPage() {
  const { hasPermission, user } = useAuth();
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [allConfigs, setAllConfigs] = useState<ClassConfiguration[]>([]);
  const [mappings, setMappings] = useState<ConfigMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [autoSaveAttempted, setAutoSaveAttempted] = useState(false);

  const canView = user?.is_superuser || hasPermission('academic.view_promotionmappingmodel');
  const canEdit = user?.is_superuser || hasPermission('academic.change_promotionmappingmodel');

  useEffect(() => {
    if (canView) {
      fetchData();
    }
  }, [canView]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesData, mappingsResponse] = await Promise.all([
        academicAPI.listClasses({ is_active: true }),
        academicAPI.getPromotionMappings(),
      ]);

      setClasses(classesData);

      // Extract all configurations from classes
      const configs: ClassConfiguration[] = [];
      classesData.forEach(cls => {
        if (cls.configurations && cls.configurations.length > 0) {
          cls.configurations.forEach(config => {
            configs.push({
              ...config,
              student_class: cls.id,
            } as any);
          });
        }
      });
      setAllConfigs(configs);

      // Build existing mappings map
      const existingMappingsMap = new Map<number, number | null>();
      if (mappingsResponse.mappings) {
        mappingsResponse.mappings.forEach((mapping: any) => {
          const fromConfigId = typeof mapping.from_class_config === 'object'
            ? mapping.from_class_config.id
            : mapping.from_class_config;
          const toConfigId = mapping.to_class_config
            ? (typeof mapping.to_class_config === 'object'
                ? mapping.to_class_config.id
                : mapping.to_class_config)
            : null;
          existingMappingsMap.set(fromConfigId, toConfigId);
        });
      }

      // Process all configurations and generate smart suggestions
      const processedMappings: ConfigMapping[] = [];

      configs.forEach(config => {
        const cls = classesData.find(c => c.id === config.student_class);
        if (!cls) return;

        const configId = config.id;
        const sectionName = config.class_section_name || null;

        // Get existing mapping if it exists
        const existingToConfigId = existingMappingsMap.get(configId);

        // Generate smart suggestion
        let suggestedToConfigId: number | null = null;

        if (!cls.is_graduation_class && cls.next_class) {
          // Find the next class
          const nextClass = classesData.find(c => c.id === cls.next_class);

          if (nextClass && nextClass.configurations) {
            // Try to find a matching section in the next class
            if (sectionName) {
              const matchingConfig = nextClass.configurations.find(
                nc => nc.class_section_name === sectionName && nc.is_active
              );
              if (matchingConfig) {
                suggestedToConfigId = matchingConfig.id;
              }
            }

            // If no matching section found or config has no section,
            // leave it blank (user will manually select)
            if (!suggestedToConfigId && !sectionName) {
              // For configs without sections, try to find a config without section in next class
              const noSectionConfig = nextClass.configurations.find(
                nc => !nc.class_section_name && nc.is_active
              );
              if (noSectionConfig) {
                suggestedToConfigId = noSectionConfig.id;
              }
            }
          }
        }

        processedMappings.push({
          from_config_id: configId,
          from_config_name: `${cls.name}${sectionName ? ' ' + sectionName : ''}`,
          from_class_id: cls.id,
          from_class_name: cls.name,
          from_section_name: sectionName,
          to_config_id: existingToConfigId !== undefined ? existingToConfigId : suggestedToConfigId,
          suggested_to_config_id: suggestedToConfigId,
          is_graduation: cls.is_graduation_class,
          class_order: cls.order,
        });
      });

      // Sort by class order, then by section name
      processedMappings.sort((a, b) => {
        if (a.class_order !== b.class_order) {
          return a.class_order - b.class_order;
        }
        const sectionA = a.from_section_name || '';
        const sectionB = b.from_section_name || '';
        return sectionA.localeCompare(sectionB);
      });

      setMappings(processedMappings);

      // Check if all mappings are valid for auto-save
      const allValid = validateMappingsForAutoSave(processedMappings);

      // Auto-save if all mappings are valid and we haven't attempted before
      if (allValid && existingMappingsMap.size === 0 && !autoSaveAttempted) {
        setAutoSaveAttempted(true);
        await handleAutoSave(processedMappings);
      } else {
        setHasChanges(existingMappingsMap.size === 0); // Set changes if no existing mappings
      }
    } catch (error: any) {
      setError(error.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const validateMappingsForAutoSave = (mappingsToCheck: ConfigMapping[]): boolean => {
    // All non-graduation configs must have a target
    return mappingsToCheck.every(mapping =>
      mapping.is_graduation || mapping.to_config_id !== null
    );
  };

  const handleAutoSave = async (mappingsToSave: ConfigMapping[]) => {
    try {
      const mappingsData = mappingsToSave.map(mapping => ({
        from_class_config_id: mapping.from_config_id,
        to_class_config_id: mapping.to_config_id,
      }));

      await academicAPI.bulkSavePromotionMappings({
      mappings: mappingsData.map(m => ({
        ...m,
        to_class_config_id: m.to_class_config_id ?? undefined,
      })),
    });

      setSuccessMessage('Promotion mappings auto-configured successfully!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setHasChanges(false);
    } catch (error: any) {
      // Silently fail auto-save, user can manually save
      console.error('Auto-save failed:', error);
    }
  };

  const handleMappingChange = (fromConfigId: number, toConfigId: number | null) => {
    setMappings(prev =>
      prev.map(mapping =>
        mapping.from_config_id === fromConfigId
          ? { ...mapping, to_config_id: toConfigId }
          : mapping
      )
    );
    setHasChanges(true);
    setValidationErrors([]);
  };

  const handleResetToSuggestions = () => {
    setMappings(prev =>
      prev.map(mapping => ({
        ...mapping,
        to_config_id: mapping.suggested_to_config_id,
      }))
    );
    setHasChanges(true);
    setValidationErrors([]);
  };

  const validateMappings = (): boolean => {
    const errors: string[] = [];

    // Check that all non-graduation configs have a target
    mappings.forEach(mapping => {
      if (!mapping.is_graduation && !mapping.to_config_id) {
        errors.push(`${mapping.from_config_name} must have a promotion target`);
      }
    });

    // Check for circular references
    const hasCircular = mappings.some(mapping => {
      if (!mapping.to_config_id) return false;

      // Check if any config promotes to this config and this config promotes back
      const targetMapping = mappings.find(m => m.from_config_id === mapping.to_config_id);
      return targetMapping && targetMapping.to_config_id === mapping.from_config_id;
    });

    if (hasCircular) {
      errors.push('Circular promotion detected: Two configurations cannot promote to each other');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateMappings()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare mappings for submission
      const mappingsToSave = mappings.map(mapping => ({
        from_class_config_id: mapping.from_config_id,
        to_class_config_id: mapping.to_config_id,
      }));

      await academicAPI.bulkSavePromotionMappings({
      mappings: mappingsToSave.map(m => ({
        ...m,
        to_class_config_id: m.to_class_config_id ?? undefined,
      })),
    });

      setSuccessMessage('Promotion mappings saved successfully!');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      setHasChanges(false);

      // Refresh data to get updated mappings
      await fetchData();
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to save promotion mappings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvailableTargetConfigs = (fromClassId: number): ClassConfiguration[] => {
    // Get the from class to find its next_class
    const fromClass = classes.find(c => c.id === fromClassId);
    if (!fromClass || !fromClass.next_class) {
      return []; // No next_class set, return empty array
    }

    // Only return configs from the next_class
    return allConfigs.filter(
      config => config.student_class === fromClass.next_class && config.is_active
    );
  };

  // Check if save button should be disabled
  const canSave = () => {
    // All non-graduation mappings must have a target
    return mappings.every(mapping =>
      mapping.is_graduation || mapping.to_config_id !== null
    );
  };

  // Group mappings by class for better display
  const groupedMappings: GroupedMappings = {};
  mappings.forEach(mapping => {
    if (!groupedMappings[mapping.from_class_name]) {
      groupedMappings[mapping.from_class_name] = [];
    }
    groupedMappings[mapping.from_class_name].push(mapping);
  });

  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view promotion mappings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
            <Check className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            Promotion Mappings
          </h1>
          <p className="text-gray-600">Define which class configuration students should be promoted to</p>
        </div>
        {canEdit && hasChanges && (
          <div className="flex gap-3">
            <button
              onClick={handleResetToSuggestions}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Suggestions
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting || !canSave()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save All Mappings
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">How Promotion Mappings Work</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Each class configuration needs a promotion target (where students go next year)</li>
              <li>System suggests targets based on class promotion settings and matching sections</li>
              <li>You can manually set any configuration to promote to any other (e.g., SS1 A → SS2 B)</li>
              <li>Graduation class configurations don't need targets - students complete their education</li>
              <li>All mappings must be complete before saving (all-or-nothing)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-2">Validation Errors</h3>
              <ul className="text-sm text-red-800 space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Mappings Table - Grouped by Class */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading promotion mappings...</p>
          </div>
        ) : mappings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <GraduationCap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Class Configurations Available</h3>
            <p className="text-gray-600">Create classes with configurations first to set up promotion mappings.</p>
          </div>
        ) : (
          Object.entries(groupedMappings).map(([className, classConfigs]) => (
            <div key={className} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Class Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-3 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-indigo-600" />
                  {className}
                  {classConfigs[0].is_graduation && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      Graduation Class
                    </span>
                  )}
                </h3>
              </div>

              {/* Configurations Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        From Configuration
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">
                        <ArrowRight className="h-4 w-4 mx-auto" />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        To Configuration (Promotion Target)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {classConfigs.map((mapping) => {
                      const availableConfigs = getAvailableTargetConfigs(mapping.from_class_id);
                      const isSuggested = mapping.to_config_id === mapping.suggested_to_config_id;
                      const hasTarget = mapping.to_config_id !== null;

                      return (
                        <tr key={mapping.from_config_id} className="hover:bg-gray-50 transition-colors">
                          {/* From Config */}
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">
                              {mapping.from_config_name}
                            </p>
                          </td>

                          {/* Arrow */}
                          <td className="px-6 py-4 text-center">
                            <ArrowRight className="h-4 w-4 text-gray-400 mx-auto" />
                          </td>

                          {/* To Config Dropdown */}
                          <td className="px-6 py-4">
                            {mapping.is_graduation ? (
                              <span className="text-sm text-gray-500 italic">No promotion (graduation)</span>
                            ) : availableConfigs.length === 0 ? (
                              <div>
                                <span className="text-sm text-amber-600 italic">No promotion class set</span>
                                <p className="text-xs text-amber-600 mt-1">Configure next_class in class settings first</p>
                              </div>
                            ) : canEdit ? (
                              <select
                                value={mapping.to_config_id || ''}
                                onChange={(e) => handleMappingChange(
                                  mapping.from_config_id,
                                  e.target.value ? Number(e.target.value) : null
                                )}
                                disabled={isSubmitting}
                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 ${
                                  !hasTarget
                                    ? 'border-red-300 bg-red-50'
                                    : isSuggested
                                    ? 'border-green-300 bg-green-50'
                                    : 'border-gray-300'
                                }`}
                              >
                                <option value="">Select target configuration</option>
                                {availableConfigs.map(config => {
                                  const configClass = classes.find(c => c.id === config.student_class);
                                  const configName = `${configClass?.name || 'Unknown'}${config.class_section_name ? ' ' + config.class_section_name : ''}`;
                                  const isSuggestedOption = config.id === mapping.suggested_to_config_id;

                                  return (
                                    <option key={config.id} value={config.id}>
                                      {configName}
                                      {isSuggestedOption && ' (Suggested)'}
                                    </option>
                                  );
                                })}
                              </select>
                            ) : (
                              <span className="text-sm text-gray-900">
                                {hasTarget
                                  ? (() => {
                                      const targetConfig = allConfigs.find(c => c.id === mapping.to_config_id);
                                      const targetClass = classes.find(c => c.id === targetConfig?.student_class);
                                      return `${targetClass?.name || 'Unknown'}${targetConfig?.class_section_name ? ' ' + targetConfig.class_section_name : ''}`;
                                    })()
                                  : <span className="text-red-600">Not set</span>
                                }
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            {mapping.is_graduation ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Graduation
                              </span>
                            ) : !hasTarget ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Missing Target
                              </span>
                            ) : isSuggested ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Auto-Suggested
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Custom
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Card */}
      {!loading && mappings.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Total Configurations</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{mappings.length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">With Targets</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {mappings.filter(m => m.to_config_id !== null || m.is_graduation).length}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Graduation Configs</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {mappings.filter(m => m.is_graduation).length}
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-600 font-medium">Auto-Suggested</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {mappings.filter(m => m.to_config_id === m.suggested_to_config_id && !m.is_graduation).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}