import FaceNotFoundModal from "@/components/FaceNotFoundModal";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CheckInOutModal({ open, onClose }: Props) {
  return (
    <FaceNotFoundModal
      open={open}
      title="มีการลงเวลาเข้างานค้างไว้แล้วในระบบ"
      message="กรุณาออกงานรายการเดิมก่อน แล้วจึงลงเวลาเข้างานใหม่"
      onClose={onClose}
    />
  );
}