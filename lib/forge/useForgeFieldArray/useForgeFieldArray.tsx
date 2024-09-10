import React, { useState, useRef, useEffect } from "react";
import { useSubscribe } from "../useSubscribe";
import {
    Control,
    FieldValues,
    FieldPath,
    FieldArray,
    RegisterOptions,
    InternalFieldName,
    FieldArrayWithId,
    FieldArrayPath,
    UseFieldArrayProps,
    useFormContext,
    FieldArrayMethodProps,
    FormState,
    get,
    set,
    FieldErrors,
    Field,
} from "react-hook-form";
import {
    appendAt,
    cloneObject,
    convertToArrayPayload,
    fillEmptyArray,
    generateId,
    getFocusFieldName,
    getValidationModes,
    isEmptyObject,
    isWatched,
    iterateFieldsByAction,
    removeArrayAt,
    unset,
    updateFieldArrayRootError,
    VALIDATION_MODE,
} from "../utils";
import validateField from "../validateField";

type ForgeFieldArray<
    T extends FieldValues,
    TF extends FieldArrayPath<T>,
    TK extends string = "id",
    IN extends unknown = unknown
> = UseFieldArrayProps<T, TF, TK> & {
    inputProps?: IN;
};

type FieldsArray<T> = {
    id: string;
    inputProps?: T[];
};

export const useForgeFieldArray = <
    InputProps extends unknown,
    TFieldValues extends FieldValues = FieldValues,
    TFieldArrayName extends FieldArrayPath<TFieldValues> = FieldArrayPath<TFieldValues>,
    TKeyName extends string = "id"
>(
    props: ForgeFieldArray<TFieldValues, TFieldArrayName, TKeyName, InputProps>
) => {
    const methods = useFormContext();

    const { control = methods.control, name, keyName = "id", inputProps } = props;

    const [fields, setFields] = useState(control._getFieldArray(name));
    const ids = React.useRef<string[]>(
        control._getFieldArray(name).map(generateId)
    );

    const _fieldIds = useRef(fields);
    const _name = useRef(name);
    const _actioned = useRef(false);

    _name.current = name;
    _fieldIds.current = fields;
    control._names.array.add(name);

    props.rules &&
        (control as Control<TFieldValues>).register(
            name as FieldPath<TFieldValues>,
            props.rules as RegisterOptions<TFieldValues>
        );

    type Next = {
        values?: FieldValues;
        name?: InternalFieldName;
    };

    useSubscribe({
        next: ({ values, name: fieldArrayName }: Next) => {
            if (fieldArrayName === _name.current || !fieldArrayName) {
                const fieldValues = get(values, _name.current);
                if (Array.isArray(fieldValues)) {
                    setFields(fieldValues);
                    // ids.current = fieldValues.map(generateId);
                }
            }
        },
        subject: control._subjects.array,
    });

    const updateValues = React.useCallback(
        <
            T extends Partial<
                FieldArrayWithId<TFieldValues, TFieldArrayName, TKeyName>
            >[]
        >(
            updatedFieldArrayValues: T
        ) => {
            _actioned.current = true;
            control._updateFieldArray(name, updatedFieldArrayValues);
        },
        [control, name]
    );

    const append = React.useCallback(
        (
            value:
                | Partial<FieldArray<TFieldValues, TFieldArrayName>>
                | Partial<FieldArray<TFieldValues, TFieldArrayName>>[],
            options?: FieldArrayMethodProps
        ) => {
            const appendValue = convertToArrayPayload(cloneObject(value));
            const updatedFieldArrayValues = appendAt(
                control._getFieldArray(name),
                appendValue
            );
            control._names.focus = getFocusFieldName(
                name,
                updatedFieldArrayValues.length - 1,
                options
            );
            ids.current = appendAt(ids.current, appendValue.map(generateId));
            updateValues(updatedFieldArrayValues);
            setFields(updatedFieldArrayValues);
            control._updateFieldArray(name, updatedFieldArrayValues, appendAt, {
                argA: fillEmptyArray(value),
            });
        },
        [control, name]
    );

    const remove = React.useCallback(
        (index?: number | number[]) => {
            const updatedFieldArrayValues: Partial<
                FieldArrayWithId<TFieldValues, TFieldArrayName, TKeyName>
            >[] = removeArrayAt(control._getFieldArray(name), index);
            ids.current = removeArrayAt(ids.current, index);
            updateValues(updatedFieldArrayValues);
            setFields(updatedFieldArrayValues);
            control._updateFieldArray(name, updatedFieldArrayValues, removeArrayAt, {
                argA: index,
            });
        },
        [control, name]
    );

    function validateFieldOrSchema(
        name: string,
        control: Control<TFieldValues, any> | Control<FieldValues, any>
    ) {
        if (control._options.resolver) {
            validateWithResolver(name, control);
        } else {
            validateSingleField(name, control);
        }
    }

    function validateWithResolver(
        name: string,
        control: Control<TFieldValues, any> | Control<FieldValues, any>
    ) {
        control._executeSchema([name]).then((result) => {
            const error = get(result.errors, name);
            const existingError = get(control._formState.errors, name);

            if (hasErrorChanged(error, existingError)) {
                updateErrorState(name, error, control);
            }
        });
    }

    function validateSingleField(
        name: string,
        control: Control<TFieldValues, any> | Control<FieldValues, any>
    ) {
        const field = get(control._fields, name);
        if (
            field &&
            field._f &&
            !(
                getValidationModes(control._options.reValidateMode).isOnSubmit &&
                getValidationModes(control._options.mode).isOnSubmit
            )
        ) {
            validateField(
                field,
                control._formValues,
                control._options.criteriaMode === VALIDATION_MODE.all,
                control._options.shouldUseNativeValidation,
                true
            ).then((error: any) => {
                if (!isEmptyObject(error)) {
                    control._subjects.state.next({
                        errors: updateFieldArrayRootError(
                            control._formState.errors as FieldErrors<TFieldValues>,
                            error,
                            name
                        ) as FieldErrors<TFieldValues>,
                    });
                }
            });
        }
    }

    function hasErrorChanged(error: any, existingError: any) {
        return existingError
            ? (!error && existingError.type) ||
            (error &&
                (existingError.type !== error.type ||
                    existingError.message !== error.message))
            : error && error.type;
    }

    function updateErrorState(
        name: string,
        error: any,
        control: Control<TFieldValues, any> | Control<FieldValues, any>
    ) {
        if (error) {
            set(control._formState.errors, name, error);
        } else {
            unset(control._formState.errors, name);
        }
        control._subjects.state.next({
            errors: control._formState.errors as FieldErrors<TFieldValues>,
        });
    }

    function handleFieldFocus(
        control: Control<TFieldValues, any> | Control<FieldValues, any>
    ) {
        if (control._names.focus) {
            iterateFieldsByAction(control._fields, (ref, key) => {
                if (key.startsWith(control._names.focus ?? "") && ref.focus) {
                    ref.focus();
                    return 1;
                }
                return;
            });
            control._names.focus = "";
        }
    }

    useEffect(() => {
        control._state.action = false;

        if (isWatched(name, control._names)) {
            control._subjects.state.next({
                ...control._formState,
            } as FormState<TFieldValues>);
        }

        const shouldValidate =
            _actioned.current &&
            (!getValidationModes(control._options.mode).isOnSubmit ||
                control._formState.isSubmitted);

        if (shouldValidate) {
            validateFieldOrSchema(name, control);
        }

        control._subjects.values.next({
            name,
            values: { ...control._formValues },
        });

        handleFieldFocus(control);

        control._updateValid();
        _actioned.current = false;
    }, [name]);

    return {
        append,
        remove,
        fields: React.useMemo(
            () =>
                fields.map((field, index) => ({
                    ...field,
                    inputProps,
                    id: ids.current[index] || generateId(),
                })) as FieldsArray<InputProps>[],
            [fields, keyName]
        ),
    };
};