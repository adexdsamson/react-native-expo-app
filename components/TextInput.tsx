import { KeyboardTypeOptions, TextInputProps as RNTextInputProps, View, Text } from "react-native";
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useState } from "react";
import { TouchableOpacity } from "react-native";
import { EyeOff, Eye } from "@/lib/icons";

export type TextInputProps = RNTextInputProps & {
    name?: string
    className?: string;
    inputClassName?: string;
    labelClassName?: string;
    label?: string;
    startIcon?: any;
    error?: string;
    secure?: boolean;
    keyboardType?: KeyboardTypeOptions & "password";
};

export const TextInput = (props: TextInputProps) => {
    return (
        <View className="">
            <Label nativeID={props?.name ?? ""} >{props.label}</Label>
            <Input {...props} />
            {props.error && (
                <Text className={`text-red-500`}>{props.error}</Text>
            )}
        </View>
    )
}

export const TextPassword = (props: TextInputProps) => {
    const [isSecure, setIsSecure] = useState(false);
    return (
        <View className="">
            <Label nativeID={props?.name ?? ""} >{props.label}</Label>
            <View className="relative">
                <Input {...props} secureTextEntry={
                    isSecure
                } />
                <View className="absolute right-4 ios:top-5.5 android:top-5">
                    <TouchableOpacity
                        onPress={() => {
                            setIsSecure(!isSecure);
                        }}
                    >
                        {isSecure ? (
                            <EyeOff className="text-sm text-gray-400" />
                        ) : (
                            <Eye className="text-sm text-gray-400" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
            {props.error && (
                <Text className={`text-red-500`}>{props.error}</Text>
            )}
        </View>
    )
}
