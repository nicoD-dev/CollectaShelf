import { useRef, useState } from "react";
import { StyleSheet, Text, View, Button, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from "@react-navigation/native";
import type {StaticScreenProps} from '@react-navigation/native';
 
{/* Recibe la carpeta donde se guardan las fotos */}
type Props = StaticScreenProps<{
    folderURI: string;
}>;


export default function CameraScreen({ route }: Props) {
    const {folderURI} = route.params;
    const navigation = useNavigation();

    {/* cameraRef es un control de la camara. Permitre pedir tomar una foto */}
    const cameraRef = useRef<CameraView>(null);
    {/* Estado del permiso de la camara */}
    const [permission, requestPermission] = useCameraPermissions();
    {/* Evita tocar el boton nuevamente mientras se guarda */}
    const [saving, setSaving] = useState(false);

    {/* Toma la foto y la guarda en el destino elegido */}
    async function takePhoto() {
        if (!cameraRef.current || saving) return;
        setSaving(true);
        try {
            {/* Base64 es la foto en formato de texto, para poder guardarla */}
            const photo = await cameraRef.current.takePictureAsync({base64: true, quality: 1, exif: false});
            if (!photo || !photo.base64) throw new Error('Sin foto');

            {/* Se crea archivo vacio en la carpeta, donde se escriben los datos */}
            const file = await FileSystem.StorageAccessFramework.createFileAsync(folderURI, `photo_${Date.now()}`, 'image/png');

            {/* Se "escribe" la foto */}
            await FileSystem.writeAsStringAsync(file, photo.base64, {encoding: FileSystem.EncodingType.Base64});

            {/* Se regresa a la galeria */}
            navigation.goBack();
        } catch (error) {
            console.error('Error al guardar la foto', error);
            Alert.alert('Error', 'No se pudo guardar la foto');
            setSaving(false);
        }
    }

    {/* Todavia no se sabe si hay permiso */}
    if (!permission) return <View style={styles.container}/>;

    {/* No hay permiso */}
    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>Se necesita permiso para usar la camara</Text>
                <Button title='Dar permiso' onPress={requestPermission}/>
            </View>
        );
    }
    return (
        <View style={styles.container}>
            {/* Vista de la camara (trasera) */}
            <CameraView ref={cameraRef} style={styles.camera} facing='back'/>
            <View style={styles.button}>
                <Button title={saving ? 'Guardando...' : 'Tomar foto'} onPress={takePhoto} disabled={saving}/>
            </View>
        </View>
    );

}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: 1,
  },
  camera: {
    flex: 1,
  },
  button: {
    padding: 20,
    height: 120
  },
});